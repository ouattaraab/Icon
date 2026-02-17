<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('machines', function (Blueprint $table) {
            // Store first 16 chars of API key in clear for O(1) lookup
            $table->string('api_key_prefix', 16)->nullable()->after('api_key_hash');
            // Per-machine HMAC secret (Laravel encrypted)
            $table->text('hmac_secret_encrypted')->nullable()->after('api_key_prefix');

            $table->index('api_key_prefix');
        });

        Schema::table('users', function (Blueprint $table) {
            // Opt-in email notifications for critical alerts
            $table->boolean('notify_critical_alerts')->default(false)->after('role');
        });
    }

    public function down(): void
    {
        Schema::table('machines', function (Blueprint $table) {
            $table->dropIndex(['api_key_prefix']);
            $table->dropColumn(['api_key_prefix', 'hmac_secret_encrypted']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('notify_critical_alerts');
        });
    }
};
