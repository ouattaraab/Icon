<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('machine_id')->references('id')->on('machines');
            $table->string('event_type', 50);
            $table->string('platform', 100)->nullable();
            $table->string('domain')->nullable();
            $table->foreignUuid('rule_id')->nullable()->references('id')->on('rules');
            $table->string('severity', 20)->nullable();
            $table->string('elasticsearch_id')->nullable();
            $table->jsonb('metadata')->nullable();
            $table->timestamp('occurred_at');
            $table->timestamps();

            $table->index(['machine_id', 'occurred_at']);
            $table->index(['event_type', 'created_at']);
            $table->index('platform');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('events');
    }
};
