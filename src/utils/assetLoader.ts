/**
 * Utility to load assets as text and convert them for use in WebView
 */
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";

/**
 * Load the KLineCharts Pro library from assets as text
 * @returns Promise<string> The library code as a string
 */
export async function loadKLineChartsProLibrary(): Promise<string> {
  try {
    console.log("Starting to load KLineCharts Pro library from assets...");

    // Load the asset
    const asset = Asset.fromModule(
      require("../../assets/lib/klinecharts-pro.umd.js")
    );

    console.log("Asset module loaded, downloading...");

    // Make sure the asset is downloaded to local storage
    if (!asset.downloaded) {
      await asset.downloadAsync();
    }

    // Get the local URI - this should be available after download
    const localUri = asset.localUri;
    if (!localUri) {
      throw new Error("Asset local URI not available after download");
    }

    console.log("Loading library from:", localUri);

    // Use FileSystem to read the content as text (React Native compatible)
    const libraryCode = await FileSystem.readAsStringAsync(localUri);

    console.log(
      "Library loaded successfully, size:",
      libraryCode.length,
      "characters"
    );

    // Validate that we actually got JavaScript code
    if (!libraryCode || libraryCode.length < 100) {
      throw new Error("Library code appears to be empty or too small");
    }

    return libraryCode;
  } catch (error) {
    console.error("Failed to load KLineCharts Pro library:", error);
    // Re-throw with more context
    throw new Error(`Asset loading failed: ${error.message}`);
  }
}

/**
 * Create a data URI from the library code for inline script loading
 * @param libraryCode The library code as string
 * @returns string Data URI for the script
 */
export function createLibraryDataUri(libraryCode: string): string {
  // For React Native, we'll use a simple approach without base64 encoding
  // The WebView can handle JavaScript directly
  return `data:application/javascript;charset=utf-8,${encodeURIComponent(
    libraryCode
  )}`;
}

/**
 * Alternative method: Create inline script content
 * @param libraryCode The library code as string
 * @returns string Script content ready for inline use
 */
export function createInlineScript(libraryCode: string): string {
  // Return the code wrapped in an IIFE to avoid global pollution
  return `(function() {
    ${libraryCode}
  })();`;
}
