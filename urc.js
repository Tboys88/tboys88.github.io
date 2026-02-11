export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Menangani preflight request (OPTIONS)
    // Browser mengirim ini sebelum request utama untuk mengecek izin CORS.
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
          "Access-Control-Allow-Headers": request.headers.get("Access-Control-Request-Headers") || "*",
        },
      });
    }

    // 2. Mengambil URL target dari path
    // Contoh: https://myworker.dev/https://example.com/stream.mpd
    // Kita membuang bagian 'https://myworker.dev/' untuk mendapatkan target.
    // substring(1) menghapus tanda slash awal '/'.
    let targetUrl = url.pathname.substring(1) + url.search;

    // Perbaikan jika URL target tidak memiliki protokol (opsional/jaga-jaga)
    // Namun sesuai request Anda, formatnya harus lengkap (https://...)
    if (!targetUrl.startsWith("http")) {
      // Jika user mengakses root worker tanpa target, beri petunjuk.
      if (targetUrl === "") {
        return new Response("Usage: https://" + url.hostname + "/https://target-url.com/stream.mpd", {
          status: 200, 
          headers: {'content-type': 'text/plain'}
        });
      }
      // Jika format salah, anggap https
      targetUrl = "https://" + targetUrl;
    }

    // 3. Mempersiapkan Request ke server asli
    // Kita perlu mengubah header agar server asli tidak memblokir request dari Worker.
    const newRequestHeaders = new Headers(request.headers);
    
    // Set Origin dan Referer seolah-olah request datang langsung dari domain target
    // Ini membantu melewati proteksi hotlink sederhana.
    const targetUrlObj = new URL(targetUrl);
    newRequestHeaders.set("Origin", targetUrlObj.origin);
    newRequestHeaders.set("Referer", targetUrlObj.origin);
    
    // Hapus header host asli agar tidak bentrok
    newRequestHeaders.delete("Host");

    try {
      // 4. Fetch konten dari server asli
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: newRequestHeaders,
        redirect: "follow", // Ikuti redirect jika ada
      });

      // 5. Membuat Response baru untuk dikirim ke Browser
      const newResponseHeaders = new Headers(response.headers);

      // TIMPA header CORS agar browser mengizinkan pemutaran (PENTING)
      newResponseHeaders.set("Access-Control-Allow-Origin", "*");
      newResponseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
      newResponseHeaders.set("Access-Control-Allow-Headers", "*");

      // Opsional: Hapus header keamanan ketat dari sumber jika ada (seperti X-Frame-Options)
      newResponseHeaders.delete("X-Frame-Options");
      newResponseHeaders.delete("Content-Security-Policy");

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newResponseHeaders,
      });

    } catch (err) {
      // Error handling jika fetch gagal
      return new Response("Proxy Error: " + err.message, { status: 500 });
    }
  },
};
