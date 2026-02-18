<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Icon - Rapport de Monitoring IA</title>
    <style>
        /* ── Reset & Base ──────────────────────────────────────────── */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'DejaVu Sans', sans-serif;
            font-size: 10px;
            color: #2d3748;
            line-height: 1.5;
            padding: 0 20px;
        }

        /* ── Header ────────────────────────────────────────────────── */
        .header {
            text-align: center;
            padding: 20px 0 16px;
            margin-bottom: 20px;
            border-bottom: 3px solid #1e3a5f;
        }
        .header h1 {
            font-size: 22px;
            font-weight: 700;
            color: #1e3a5f;
            margin-bottom: 4px;
            letter-spacing: 0.5px;
        }
        .header .subtitle {
            font-size: 12px;
            color: #4a5568;
            margin-bottom: 2px;
        }
        .header .generation-date {
            font-size: 9px;
            color: #a0aec0;
        }

        /* ── Section titles ────────────────────────────────────────── */
        .section {
            margin-bottom: 22px;
            page-break-inside: avoid;
        }
        .section-title {
            font-size: 13px;
            font-weight: 700;
            color: #ffffff;
            background-color: #1e3a5f;
            padding: 6px 10px;
            margin-bottom: 8px;
            letter-spacing: 0.3px;
        }

        /* ── Summary stats cards ───────────────────────────────────── */
        .stats-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 0;
        }
        .stats-table td {
            width: 33.33%;
            text-align: center;
            padding: 12px 8px;
            border: 1px solid #cbd5e0;
            background-color: #f7fafc;
        }
        .stat-value {
            font-size: 22px;
            font-weight: 700;
            line-height: 1.2;
        }
        .stat-label {
            font-size: 8px;
            color: #718096;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            margin-top: 2px;
        }
        .color-navy { color: #1e3a5f; }
        .color-green { color: #276749; }
        .color-purple { color: #553c9a; }
        .color-red { color: #c53030; }
        .color-orange { color: #c05621; }
        .color-darkred { color: #9b2c2c; }

        /* ── Tables ────────────────────────────────────────────────── */
        table.data-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 4px;
            font-size: 10px;
        }
        table.data-table thead th {
            background-color: #1e3a5f;
            color: #ffffff;
            padding: 6px 8px;
            text-align: left;
            font-size: 9px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border: 1px solid #1e3a5f;
        }
        table.data-table thead th.text-right {
            text-align: right;
        }
        table.data-table tbody td {
            padding: 5px 8px;
            border: 1px solid #e2e8f0;
            font-size: 10px;
        }
        table.data-table tbody td.text-right {
            text-align: right;
        }
        table.data-table tbody td.text-center {
            text-align: center;
        }
        table.data-table tbody td.bold {
            font-weight: 700;
        }
        table.data-table tbody tr:nth-child(even) {
            background-color: #f0f4f8;
        }
        table.data-table tbody tr:nth-child(odd) {
            background-color: #ffffff;
        }

        /* ── Severity badges ───────────────────────────────────────── */
        .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 8px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }
        .badge-critical { background-color: #fed7d7; color: #9b2c2c; }
        .badge-warning { background-color: #fefcbf; color: #975a16; }
        .badge-info { background-color: #bee3f8; color: #2a4365; }
        .badge-open { background-color: #dbeafe; color: #1e40af; }
        .badge-acknowledged { background-color: #d1fae5; color: #065f46; }
        .badge-resolved { background-color: #f1f5f9; color: #64748b; }

        /* ── Alert severity summary cards ──────────────────────────── */
        .severity-table {
            width: 100%;
            border-collapse: collapse;
        }
        .severity-table td {
            width: 33.33%;
            text-align: center;
            padding: 10px 8px;
            border: 1px solid #cbd5e0;
        }
        .severity-critical-bg { background-color: #fff5f5; }
        .severity-warning-bg { background-color: #fffff0; }
        .severity-info-bg { background-color: #ebf8ff; }
        .severity-value {
            font-size: 20px;
            font-weight: 700;
            line-height: 1.2;
        }
        .severity-label {
            font-size: 8px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            margin-top: 2px;
        }

        /* ── Progress bar for platform usage ───────────────────────── */
        .progress-bg {
            height: 8px;
            background-color: #e2e8f0;
            border-radius: 4px;
            overflow: hidden;
            display: block;
        }
        .progress-fill {
            height: 8px;
            background-color: #1e3a5f;
            border-radius: 4px;
            display: block;
        }

        /* ── No data ───────────────────────────────────────────────── */
        .no-data {
            color: #a0aec0;
            font-size: 10px;
            font-style: italic;
            padding: 8px 0;
        }

        /* ── Footer ────────────────────────────────────────────────── */
        .footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            text-align: center;
            font-size: 8px;
            color: #a0aec0;
            border-top: 1px solid #cbd5e0;
            padding: 8px 20px;
            background-color: #ffffff;
        }
        .footer .confidential {
            font-weight: 700;
            color: #718096;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        /* ── Page break helper ─────────────────────────────────────── */
        .page-break {
            page-break-before: always;
        }
    </style>
</head>
<body>

    {{-- ━━━━━ Header ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ --}}
    <div class="header">
        <h1>Icon - Rapport de Monitoring IA</h1>
        <div class="subtitle">
            P&eacute;riode du {{ \Carbon\Carbon::parse($dateFrom)->translatedFormat('d F Y') }}
            au {{ \Carbon\Carbon::parse($dateTo)->translatedFormat('d F Y') }}
        </div>
        <div class="generation-date">
            G&eacute;n&eacute;r&eacute; le {{ $generatedAt }}
        </div>
    </div>

    {{-- ━━━━━ Summary Statistics ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ --}}
    <div class="section">
        <div class="section-title">R&eacute;sum&eacute; g&eacute;n&eacute;ral</div>
        <table class="stats-table">
            <tr>
                <td>
                    <div class="stat-value color-navy">{{ number_format($stats['total_events'], 0, ',', ' ') }}</div>
                    <div class="stat-label">&Eacute;v&eacute;nements totaux</div>
                </td>
                <td>
                    <div class="stat-value color-red">{{ number_format($stats['blocked_events'], 0, ',', ' ') }}</div>
                    <div class="stat-label">Blocages</div>
                </td>
                <td>
                    <div class="stat-value color-orange">{{ number_format($stats['open_alerts'], 0, ',', ' ') }}</div>
                    <div class="stat-label">Alertes ouvertes</div>
                </td>
            </tr>
            <tr>
                <td>
                    <div class="stat-value color-navy">{{ number_format($stats['total_machines'], 0, ',', ' ') }}</div>
                    <div class="stat-label">Machines actives</div>
                </td>
                <td>
                    <div class="stat-value color-green">{{ number_format($stats['online_machines'], 0, ',', ' ') }}</div>
                    <div class="stat-label">Machines en ligne</div>
                </td>
                <td>
                    <div class="stat-value color-darkred">{{ number_format($stats['critical_alerts'], 0, ',', ' ') }}</div>
                    <div class="stat-label">Alertes critiques</div>
                </td>
            </tr>
        </table>
    </div>

    {{-- ━━━━━ Platform Usage Breakdown ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ --}}
    <div class="section">
        <div class="section-title">Usage par plateforme IA</div>
        @if($platformUsage->isNotEmpty())
            @php
                $totalPlatformEvents = $platformUsage->sum('count');
            @endphp
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Plateforme</th>
                        <th class="text-right">&Eacute;v&eacute;nements</th>
                        <th class="text-right">Pourcentage</th>
                        <th style="width: 35%;">R&eacute;partition</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($platformUsage as $item)
                        @php
                            $percentage = $totalPlatformEvents > 0
                                ? round(($item->count / $totalPlatformEvents) * 100, 1)
                                : 0;
                        @endphp
                        <tr>
                            <td class="bold">{{ ucfirst($item->platform) }}</td>
                            <td class="text-right">{{ number_format($item->count, 0, ',', ' ') }}</td>
                            <td class="text-right">{{ number_format($percentage, 1, ',', ' ') }} %</td>
                            <td>
                                <div class="progress-bg">
                                    <div class="progress-fill" style="width: {{ $percentage }}%;"></div>
                                </div>
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        @else
            <p class="no-data">Aucune donn&eacute;e de plateforme pour cette p&eacute;riode.</p>
        @endif
    </div>

    {{-- ━━━━━ Top 10 Machines ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ --}}
    <div class="section">
        <div class="section-title">Top 10 machines par activit&eacute;</div>
        @if($topMachines->isNotEmpty())
            <table class="data-table">
                <thead>
                    <tr>
                        <th style="width: 30px;">#</th>
                        <th>Hostname</th>
                        <th>D&eacute;partement</th>
                        <th class="text-right">&Eacute;v&eacute;nements</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($topMachines as $idx => $machine)
                        <tr>
                            <td class="text-center">{{ $idx + 1 }}</td>
                            <td class="bold">{{ $machine->hostname }}</td>
                            <td>{{ $machine->department ?: "\u{2014}" }}</td>
                            <td class="text-right bold">{{ number_format($machine->event_count, 0, ',', ' ') }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        @else
            <p class="no-data">Aucune activit&eacute; machine pour cette p&eacute;riode.</p>
        @endif
    </div>

    {{-- ━━━━━ Alert Severity Summary ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ --}}
    <div class="section">
        <div class="section-title">R&eacute;partition des alertes par s&eacute;v&eacute;rit&eacute;</div>
        @php
            $criticalCount = $alertSeverity['critical'] ?? 0;
            $warningCount  = $alertSeverity['warning'] ?? 0;
            $infoCount     = $alertSeverity['info'] ?? 0;
            $totalAlerts   = $criticalCount + $warningCount + $infoCount;
        @endphp
        <table class="severity-table">
            <tr>
                <td class="severity-critical-bg">
                    <div class="severity-value color-darkred">{{ number_format($criticalCount, 0, ',', ' ') }}</div>
                    <div class="severity-label" style="color: #9b2c2c;">Critiques</div>
                </td>
                <td class="severity-warning-bg">
                    <div class="severity-value color-orange">{{ number_format($warningCount, 0, ',', ' ') }}</div>
                    <div class="severity-label" style="color: #975a16;">Avertissements</div>
                </td>
                <td class="severity-info-bg">
                    <div class="severity-value color-navy">{{ number_format($infoCount, 0, ',', ' ') }}</div>
                    <div class="severity-label" style="color: #2a4365;">Informations</div>
                </td>
            </tr>
        </table>
        @if($totalAlerts > 0)
            <table class="data-table" style="margin-top: 8px;">
                <thead>
                    <tr>
                        <th>S&eacute;v&eacute;rit&eacute;</th>
                        <th class="text-right">Nombre</th>
                        <th class="text-right">Pourcentage</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach([
                        ['label' => 'Critique', 'key' => 'critical', 'count' => $criticalCount],
                        ['label' => 'Avertissement', 'key' => 'warning', 'count' => $warningCount],
                        ['label' => 'Information', 'key' => 'info', 'count' => $infoCount],
                    ] as $row)
                        <tr>
                            <td><span class="badge badge-{{ $row['key'] }}">{{ $row['label'] }}</span></td>
                            <td class="text-right bold">{{ number_format($row['count'], 0, ',', ' ') }}</td>
                            <td class="text-right">
                                {{ $totalAlerts > 0 ? number_format(($row['count'] / $totalAlerts) * 100, 1, ',', ' ') : '0,0' }} %
                            </td>
                        </tr>
                    @endforeach
                    <tr style="background-color: #edf2f7 !important; font-weight: 700;">
                        <td class="bold">Total</td>
                        <td class="text-right bold">{{ number_format($totalAlerts, 0, ',', ' ') }}</td>
                        <td class="text-right bold">100,0 %</td>
                    </tr>
                </tbody>
            </table>
        @else
            <p class="no-data" style="margin-top: 6px;">Aucune alerte pour cette p&eacute;riode.</p>
        @endif
    </div>

    {{-- ━━━━━ Department Breakdown ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ --}}
    <div class="section">
        <div class="section-title">R&eacute;partition par d&eacute;partement</div>
        @if($departmentStats->isNotEmpty())
            <table class="data-table">
                <thead>
                    <tr>
                        <th>D&eacute;partement</th>
                        <th class="text-right">Machines</th>
                        <th class="text-right">&Eacute;v&eacute;nements</th>
                        <th class="text-right">Blocages</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($departmentStats as $dept)
                        <tr>
                            <td class="bold">{{ $dept['department'] }}</td>
                            <td class="text-right">{{ number_format($dept['machine_count'], 0, ',', ' ') }}</td>
                            <td class="text-right">{{ number_format($dept['event_count'], 0, ',', ' ') }}</td>
                            <td class="text-right">{{ number_format($dept['blocked_count'], 0, ',', ' ') }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        @else
            <p class="no-data">Aucune donn&eacute;e de d&eacute;partement disponible.</p>
        @endif
    </div>

    {{-- ━━━━━ Recent Alerts Detail ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ --}}
    <div class="section page-break">
        <div class="section-title">Derni&egrave;res alertes (20 max)</div>
        @if($recentAlerts->isNotEmpty())
            <table class="data-table">
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
                            <td style="white-space: nowrap;">{{ $alert->created_at?->format('d/m/Y H:i') }}</td>
                            <td>
                                <span class="badge badge-{{ $alert->severity }}">
                                    {{ $alert->severity }}
                                </span>
                            </td>
                            <td>{{ \Illuminate\Support\Str::limit($alert->title, 50) }}</td>
                            <td>{{ $alert->machine?->hostname ?? "\u{2014}" }}</td>
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
            <p class="no-data">Aucune alerte pour cette p&eacute;riode.</p>
        @endif
    </div>

    {{-- ━━━━━ Footer ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ --}}
    <div class="footer">
        <span class="confidential">Confidentiel - GS2E</span>
        &nbsp;&nbsp;|&nbsp;&nbsp;
        Icon - Rapport de Monitoring IA
        &nbsp;&nbsp;|&nbsp;&nbsp;
        G&eacute;n&eacute;r&eacute; le {{ $generatedAt }}
        &nbsp;&nbsp;|&nbsp;&nbsp;
        Page <script type="text/php">
            if (isset($pdf)) {
                $x = 520;
                $y = 818;
                $text = "Page {PAGE_NUM} / {PAGE_COUNT}";
                $font = $fontMetrics->get_font("DejaVu Sans", "normal");
                $size = 8;
                $color = array(0.63, 0.68, 0.75);
                $pdf->page_text($x, $y, $text, $font, $size, $color);
            }
        </script>
    </div>

</body>
</html>
