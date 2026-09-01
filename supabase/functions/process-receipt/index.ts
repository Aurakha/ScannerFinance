// Supabase Edge Function: process-receipt
// Memproses gambar struk dari client, memvalidasi auth, memanggil Gemini Vision, dan mencatat log ke PostgreSQL

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { parseReceiptWithGemini } from "./gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Ambil data user yang sedang login
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized access: " + (userError?.message || "User not found") }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { imageBase64, mimeType = "image/jpeg", storagePath } = body;

    if (!imageBase64 && !storagePath) {
      return new Response(
        JSON.stringify({ error: "Either imageBase64 or storagePath is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let rawBase64 = imageBase64;
    let actualMime = mimeType;

    // Jika diberikan storagePath, unduh dari Supabase Storage
    if (!rawBase64 && storagePath) {
      const { data: fileData, error: downloadError } = await supabaseClient
        .storage
        .from("receipts")
        .download(storagePath);

      if (downloadError || !fileData) {
        throw new Error(`Failed to download receipt from storage: ${downloadError?.message}`);
      }

      const arrayBuffer = await fileData.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < uint8Array.byteLength; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      rawBase64 = btoa(binary);
      actualMime = fileData.type || "image/jpeg";
    }

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY") || "";
    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not configured in Supabase Edge Function.");
    }

    // 1. Ekstrak data via Gemini Vision
    const parsedResult = await parseReceiptWithGemini(rawBase64, actualMime, geminiApiKey);

    // 2. Simpan audit log scan ke database Supabase
    let scanId = null;
    if (storagePath) {
      const { data: scanLog, error: logError } = await supabaseClient
        .from("receipt_scans")
        .insert({
          user_id: user.id,
          storage_path: storagePath,
          status: "completed",
          raw_ai_response: parsedResult,
        })
        .select("id")
        .single();

      if (!logError && scanLog) {
        scanId = scanLog.id;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        scan_id: scanId,
        data: parsedResult,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Error processing receipt:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Failed to process receipt" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
