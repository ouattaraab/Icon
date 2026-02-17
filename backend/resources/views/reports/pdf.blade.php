<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Rapport Icon — {{ $dateFrom }} au {{ $dateTo }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'DejaVu Sans', sans-serif;
            font-size: 11px;
            color: #1e293b;
            line-height: 1.5;
        }

        .header {
            text-align: center;
            margin-bottom: 24px;
            border-bottom: 3px solid #3b82f6;
            padding-bottom: 16px;
        }
        .header h1 {
            font-size: 22px;
            color: #0f172a;
            margin-bottom: 4px;
        }
        .header .subtitle {
            font-size: 13px;
            color: #64748b;
        }
        .header .date {
            font-size: 10px;
            color: #94a3b8;
            margin-top: 4px;
        }

        .section {
            margin-bottom: 20px;
        }
        .section-title {
            font-size: 14px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 10px;
            padding-bottom: 4px;
            border-bottom: 1px solid #e2e8f0;
        }

        /* Stats grid */
        .stats-grid {
            display: table;
            width: 100%;
            margin-bottom: 20px;
        }
        .stats-row {
            display: table-row;
        }
        .stat-card {
            display: table-cell;
            width: 33.33%;
            text-align: center;
            padding: 10px 8px;
            border: 1px solid #e2e8f0;
            background: #f8fafc;
        }
        .stat-value {
            font-size: 24px;
            font-weight: 700;
        }
        .stat-label {
            font-size: 9px;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .color-blue { color: #3b82f6; }
        .color-green { color: #22c55e; }
        .color-purple { color: #8b5cf6; }
        .color-red { color: #ef4444; }
        .color-orange { color: #f59e0b; }
        .color-darkred { color: #dc2626; }

        /* Tables */
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 6px;
        }
        table th {
            background: #f1f5f9;
            padding: 6px 8px;
            text-align: left;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #64748b;
            font-weight: 600;
            border-bottom: 2px solid #e2e8f0;
        }
        table td {
            padding: 5px 8px;
            border-bottom: 1px solid #f1f5f9;
            font-size: 10px;
        }
        table tr:nth-child(even) {
            background: #f8fafc;
        }

        /* Badge */
        .badge {
            display: inline-block;
            padding: 1px 6px;
            border-radius: 3px;
            font-size: 9px;
            font-weight: 600;
        }
        .badge-critical { background: #fef2f2; color: #dc2626; }
        .badge-warning { background: #fffbeb; color: #d97706; }
        .badge-open { background: #eff6ff; color: #2563eb; }
        .badge-acknowledged { background: #f0fdf4; color: #16a34a; }
        .badge-resolved { background: #f8fafc; color: #64748b; }

        /* Platform bar */
        .platform-row {
            margin-bottom: 6px;
        }
        .platform-name {
            font-size: 10px;
            font-weight: 500;
            margin-bottom: 2px;
        }
        .platform-bar-bg {
            height: 10px;
            background: #f1f5f9;
            border-radius: 5px;
            overflow: hidden;
        }
        .platform-bar {
            height: 100%;
            border-radius: 5px;
            background: #3b82f6;
        }
        .platform-count {
            font-size: 9px;
            color: #64748b;
            float: right;
        }

        .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 9px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
            padding-top: 10px;
        }
    </style>
</head>
<body>

    {{-- Header --}}
    <div class="header">
        <h1>Icon — Rapport de monitoring IA</h1>
        <div class="subtitle">P&eacute;riode : {{ $dateFrom }} au {{ $dateTo }}</div>
        <div class="date">G&eacute;n&eacute;r&eacute; le {{ $generatedAt }}</div>
    </div>

    {{-- Stats --}}
    <div class="section">
        <div class="section-title">Vue d'ensemble</div>
        <table>
            <tr>
                <td style="text-align:center; padding:12px; border:1px solid #e2e8f0; background:#f8fafc;">
                    <div class="stat-value color-blue">{{ $stats['total_machines'] }}</div>
                    <div class="stat-label">Machines actives</div>
                </td>
                <td style="text-align:center; padding:12px; border:1px solid #e2e8f0; background:#f8fafc;">
                    <div class="stat-value color-green">{{ $stats['online_machines'] }}</div>
                    <div class="stat-label">En ligne</div>
                </td>
                <td style="text-align:center; padding:12px; border:1px solid #e2e8f0; background:#f8fafc;">
                    <div class="stat-value color-purple">{{ $stats['total_events'] }}</div>
                    <div class="stat-label">&Eacute;v&eacute;nements</div>
                </td>
            </tr>
            <tr>
                <td style="text-align:center; padding:12px; border:1px solid #e2e8f0; background:#f8fafc;">
                    <div class="stat-value color-red">{{ $stats['blocked_events'] }}</div>
                    <div class="stat-label">Blocages</div>
                </td>
                <td style="text-align:center; padding:12px; border:1px solid #e2e8f0; background:#f8fafc;">
                    <div class="stat-value color-orange">{{ $stats['open_alerts'] }}</div>
                    <div class="stat-label">Alertes ouvertes</div>
                </td>
                <td style="text-align:center; padding:12px; border:1px solid #e2e8f0; background:#f8fafc;">
                    <div class="stat-value color-darkred">{{ $stats['critical_alerts'] }}</div>
                    <div class="stat-label">Alertes critiques</div>
                </td>
            </tr>
        </table>
    </div>

    {{-- Platform usage --}}
    <div class="section">
        <div class="section-title">Usage par plateforme IA</div>
        @if($platformUsage->isNotEmpty())
            @php $maxCount = $platformUsage->first()->count; @endphp
            @foreach($platformUsage as $item)
                <div class="platform-row">
                    <div class="platform-name">
                        {{ ucfirst($item->platform) }}
                        <span class="platform-count">{{ $item->count }} &eacute;v&eacute;nements</span>
                    </div>
                    <div class="platform-bar-bg">
                        <div class="platform-bar" style="width: {{ $maxCount > 0 ? round(($item->count / $maxCount) * 100) : 0 }}%;"></div>
                    </div>
                </div>
            @endforeach
        @else
            <p style="color:#94a3b8; font-size:10px;">Aucune donn&eacute;e pour cette p&eacute;riode.</p>
        @endif
    </div>

    {{-- Top machines --}}
    <div class="section">
        <div class="section-title">Top 10 machines par activit&eacute; IA</div>
        @if($topMachines->isNotEmpty())
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Hostname</th>
                        <th>Utilisateur</th>
                        <th>D&eacute;partement</th>
                        <th style="text-align:right">&Eacute;v&eacute;nements</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($topMachines as $idx => $machine)
                        <tr>
                            <td>{{ $idx + 1 }}</td>
                            <td style="font-weight:600;">{{ $machine->hostname }}</td>
                            <td>{{ $machine->assigned_user ?: '—' }}</td>
                            <td>{{ $machine->department ?: '—' }}</td>
                            <td style="text-align:right; font-weight:700;">{{ $machine->event_count }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        @else
            <p style="color:#94a3b8; font-size:10px;">Aucune activit&eacute; pour cette p&eacute;riode.</p>
        @endif
    </div>

    {{-- Recent alerts --}}
    <div class="section">
        <div class="section-title">Derni&egrave;res alertes (20 max)</div>
        @if($recentAlerts->isNotEmpty())
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>S&eacute;v&eacute;rit&eacute;</th>
                        <th>Titre</th>
                        <th>Machine</th>
                        <th>Statut</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($recentAlerts as $alert)
                        <tr>
                            <td>{{ $alert->created_at?->format('d/m H:i') }}</td>
                            <td>
                                <span class="badge badge-{{ $alert->severity }}">
                                    {{ $alert->severity }}
                                </span>
                            </td>
                            <td>{{ \Illuminate\Support\Str::limit($alert->title, 60) }}</td>
                            <td>{{ $alert->machine?->hostname ?? '—' }}</td>
                            <td>
                                <span class="badge badge-{{ $alert->status }}">
                                    {{ $alert->status }}
                                </span>
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        @else
            <p style="color:#94a3b8; font-size:10px;">Aucune alerte pour cette p&eacute;riode.</p>
        @endif
    </div>

    {{-- Footer --}}
    <div class="footer">
        Icon — Syst&egrave;me de monitoring IA | GS2E | Rapport confidentiel | {{ $generatedAt }}
    </div>

</body>
</html>
