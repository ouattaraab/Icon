<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('alerts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('event_id')->nullable()->references('id')->on('events');
            $table->foreignUuid('machine_id')->references('id')->on('machines');
            $table->foreignUuid('rule_id')->nullable()->references('id')->on('rules');
            $table->string('severity', 20); // warning, critical
            $table->string('title', 500);
            $table->text('description')->nullable();
            $table->string('status', 20)->default('open'); // open, acknowledged, resolved
            $table->foreignUuid('acknowledged_by')->nullable()->references('id')->on('users');
            $table->timestamp('acknowledged_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'severity', 'created_at']);
            $table->index('machine_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('alerts');
    }
};
