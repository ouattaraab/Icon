<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Icon - Documentation API</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
    <style>
        /* ── Page reset & branding ─────────────────────────────────── */
        *, *::before, *::after { box-sizing: border-box; }
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: #f8fafc;
        }

        /* ── Top banner ────────────────────────────────────────────── */
        .top-banner {
            background-color: #1e3a5f;
            color: #ffffff;
            padding: 16px 32px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }
        .top-banner .brand {
            display: flex;
            align-items: center;
            gap: 14px;
        }
        .top-banner .logo {
            width: 36px;
            height: 36px;
            background-color: #ffffff;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: 18px;
            color: #1e3a5f;
            flex-shrink: 0;
        }
        .top-banner h1 {
            font-size: 20px;
            font-weight: 700;
            margin: 0;
            letter-spacing: 0.3px;
        }
        .top-banner .subtitle {
            font-size: 12px;
            color: #94b8d8;
            margin-top: 2px;
        }
        .top-banner .back-link {
            color: #94b8d8;
            text-decoration: none;
            font-size: 13px;
            padding: 6px 14px;
            border: 1px solid rgba(148, 184, 216, 0.3);
            border-radius: 6px;
            transition: all 0.2s;
        }
        .top-banner .back-link:hover {
            background-color: rgba(255, 255, 255, 0.1);
            color: #ffffff;
            border-color: rgba(255, 255, 255, 0.4);
        }

        /* ── Swagger UI container ──────────────────────────────────── */
        #swagger-ui {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px 32px;
        }

        /* ── Swagger UI overrides for branding ─────────────────────── */
        .swagger-ui .topbar { display: none; }
        .swagger-ui .info .title {
            color: #1e3a5f;
        }
        .swagger-ui .opblock.opblock-get .opblock-summary-method {
            background: #1e3a5f;
        }
        .swagger-ui .opblock.opblock-post .opblock-summary-method {
            background: #276749;
        }
        .swagger-ui .btn.authorize {
            color: #1e3a5f;
            border-color: #1e3a5f;
        }
        .swagger-ui .btn.authorize svg {
            fill: #1e3a5f;
        }
    </style>
</head>
<body>

    <div class="top-banner">
        <div class="brand">
            <div class="logo">IC</div>
            <div>
                <h1>Icon - Documentation API</h1>
                <div class="subtitle">API Agent &mdash; GS2E</div>
            </div>
        </div>
        <a href="{{ url('/') }}" class="back-link">&larr; Retour au tableau de bord</a>
    </div>

    <div id="swagger-ui"></div>

    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
    <script>
        window.onload = function () {
            SwaggerUIBundle({
                url: "{{ url('/api/docs/spec') }}",
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "StandaloneLayout",
                defaultModelsExpandDepth: 1,
                defaultModelExpandDepth: 1,
                docExpansion: "list",
                filter: true,
                showExtensions: true,
                showCommonExtensions: true,
                persistAuthorization: true,
            });
        };
    </script>

</body>
</html>
