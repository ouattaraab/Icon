<?php

namespace App\Console\Commands;

use App\Models\AuditLog;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CleanupOldDataCommand extends Command
{
    protected $signature = 'icon:cleanup
                            {--notifications-days=30 : Delete read notifications older than N days}
                            {--audit-days=365 : Delete audit logs older than N days}';

    protected $description = 'Clean up old read notifications and audit logs';

    public function handle(): int
    {
        $notifDays = (int) $this->option('notifications-days');
        $auditDays = (int) $this->option('audit-days');

        // 1. Delete old read notifications
        $notifCutoff = now()->subDays($notifDays);
        $deletedNotifs = DB::table('notifications')
            ->whereNotNull('read_at')
            ->where('read_at', '<', $notifCutoff)
            ->delete();

        if ($deletedNotifs > 0) {
            $this->info("Deleted {$deletedNotifs} read notification(s) older than {$notifDays} days.");
        }

        // 2. Delete old audit logs
        $auditCutoff = now()->subDays($auditDays);
        $deletedAudit = AuditLog::where('created_at', '<', $auditCutoff)->delete();

        if ($deletedAudit > 0) {
            $this->info("Deleted {$deletedAudit} audit log(s) older than {$auditDays} days.");
        }

        if ($deletedNotifs === 0 && $deletedAudit === 0) {
            $this->info('Nothing to clean up.');
        }

        AuditLog::log('system.cleanup', 'System', null, [
            'deleted_notifications' => $deletedNotifs,
            'deleted_audit_logs' => $deletedAudit,
            'notification_retention_days' => $notifDays,
            'audit_retention_days' => $auditDays,
        ]);

        return self::SUCCESS;
    }
}
