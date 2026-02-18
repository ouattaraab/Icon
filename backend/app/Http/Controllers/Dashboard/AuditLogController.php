<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AuditLogController extends Controller
{
    public function index(Request $request): Response
    {
        $query = AuditLog::with('user:id,name,email')
            ->orderByDesc('created_at');

        if ($request->filled('action')) {
            $query->where('action', 'like', $request->query('action') . '%');
        }

        if ($request->filled('category')) {
            $query->where('action', 'like', $request->query('category') . '.%');
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->query('user_id'));
        }

        if ($request->filled('search')) {
            $search = $request->query('search');
            $query->where(function ($q) use ($search) {
                $q->where('target_type', 'ilike', "%{$search}%")
                    ->orWhereRaw('CAST(details AS TEXT) ILIKE ?', ["%{$search}%"]);
            });
        }

        if ($request->filled('date_from')) {
            $query->where('created_at', '>=', $request->query('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->where('created_at', '<=', $request->query('date_to') . ' 23:59:59');
        }

        $logs = $query->paginate(30)->withQueryString();

        // Get distinct action types for the filter dropdown
        $actionTypes = AuditLog::select('action')
            ->distinct()
            ->orderBy('action')
            ->pluck('action');

        // Get users for filter dropdown
        $users = User::select('id', 'name', 'email')
            ->orderBy('name')
            ->get();

        return Inertia::render('Audit/Index', [
            'logs' => $logs,
            'actionTypes' => $actionTypes,
            'users' => $users,
            'filters' => $request->only(['action', 'category', 'user_id', 'search', 'date_from', 'date_to']),
        ]);
    }
}
