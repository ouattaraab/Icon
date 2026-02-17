<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('machines', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('hostname');
            $table->string('os', 50);
            $table->string('os_version', 100)->nullable();
            $table->string('agent_version', 50)->nullable();
            $table->string('api_key_hash');
            $table->string('status', 20)->default('active'); // active, inactive, offline
            $table->timestamp('last_heartbeat')->nullable();
            $table->ipAddress('ip_address')->nullable();
            $table->string('department')->nullable();
            $table->string('assigned_user')->nullable();
            $table->timestamps();

            $table->index(['status', 'last_heartbeat']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('machines');
    }
};
