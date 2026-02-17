<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\MonitoredDomain;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DomainController extends Controller
{
    public function index(Request $request): Response
    {
        $query = MonitoredDomain::query();

        if ($request->filled('search')) {
            $search = $request->query('search');
            $query->where(function ($q) use ($search) {
                $q->where('domain', 'ilike', "%{$search}%")
                  ->orWhere('platform_name', 'ilike', "%{$search}%");
            });
        }

        if ($request->filled('status')) {
            $query->where('is_blocked', $request->query('status') === 'blocked');
        }

        if ($request->filled('platform')) {
            $query->where('platform_name', 'ilike', "%{$request->query('platform')}%");
        }

        $domains = $query->orderBy('platform_name')
            ->orderBy('domain')
            ->paginate(25)
            ->withQueryString();

        // Distinct platforms for filter dropdown
        $platforms = MonitoredDomain::select('platform_name')
            ->distinct()
            ->orderBy('platform_name')
            ->pluck('platform_name');

        return Inertia::render('Domains/Index', [
            'domains' => $domains,
            'platforms' => $platforms,
            'filters' => $request->only(['search', 'status', 'platform']),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'domain' => 'required|string|max:255|unique:monitored_domains,domain',
            'platform_name' => 'required|string|max:100',
            'is_blocked' => 'boolean',
        ]);

        $domain = MonitoredDomain::create($validated);

        AuditLog::log('domain.created', 'MonitoredDomain', $domain->id, [
            'domain' => $domain->domain,
            'platform_name' => $domain->platform_name,
        ]);

        return back()->with('success', "Domaine « {$domain->domain} » ajouté.");
    }

    public function update(Request $request, MonitoredDomain $domain)
    {
        $validated = $request->validate([
            'domain' => "required|string|max:255|unique:monitored_domains,domain,{$domain->id}",
            'platform_name' => 'required|string|max:100',
            'is_blocked' => 'boolean',
        ]);

        $domain->update($validated);

        AuditLog::log('domain.updated', 'MonitoredDomain', $domain->id, [
            'domain' => $domain->domain,
            'is_blocked' => $domain->is_blocked,
        ]);

        return back()->with('success', "Domaine « {$domain->domain} » mis à jour.");
    }

    public function destroy(MonitoredDomain $domain)
    {
        $domainName = $domain->domain;

        AuditLog::log('domain.deleted', 'MonitoredDomain', $domain->id, [
            'domain' => $domainName,
        ]);

        $domain->delete();

        return back()->with('success', "Domaine « {$domainName} » supprimé.");
    }

    public function toggleBlocked(MonitoredDomain $domain)
    {
        $domain->update(['is_blocked' => !$domain->is_blocked]);

        $action = $domain->is_blocked ? 'domain.blocked' : 'domain.unblocked';
        AuditLog::log($action, 'MonitoredDomain', $domain->id, [
            'domain' => $domain->domain,
        ]);

        $status = $domain->is_blocked ? 'bloqué' : 'surveillé';
        return back()->with('success', "Domaine « {$domain->domain} » : {$status}.");
    }
}
