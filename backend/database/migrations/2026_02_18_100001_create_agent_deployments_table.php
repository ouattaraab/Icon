<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agent_deployments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('machine_id')->references('id')->on('machines')->cascadeOnDelete();
            $table->string('version', 50);
            $table->string('previous_version', 50)->nullable();
            $table->string('status', 20); // success, failed, pending, rolled_back
            $table->string('deployment_method', 50)->nullable(); // auto_update, manual, gpo, mdm
            $table->text('error_message')->nullable();
            $table->timestamp('deployed_at');
            $table->timestamps();

            $table->index('machine_id');
            $table->index('deployed_at');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_deployments');
    }
};
