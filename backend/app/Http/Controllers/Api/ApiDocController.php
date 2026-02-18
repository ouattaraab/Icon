<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Symfony\Component\Yaml\Yaml;

class ApiDocController extends Controller
{
    /**
     * Display the Swagger UI documentation page.
     */
    public function index()
    {
        return view('api.docs');
    }

    /**
     * Return the OpenAPI spec as JSON.
     */
    public function spec(): JsonResponse
    {
        $yamlPath = base_path('docs/openapi.yaml');

        if (! file_exists($yamlPath)) {
            return response()->json([
                'error' => 'OpenAPI specification file not found.',
            ], 404);
        }

        $yaml = file_get_contents($yamlPath);
        $spec = Yaml::parse($yaml);

        return response()->json($spec);
    }
}
