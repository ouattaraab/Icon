<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rules', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('category', 20); // block, alert, log
            $table->string('target', 20);   // prompt, response, clipboard, domain
            $table->string('condition_type', 50); // regex, keyword, domain_list, content_length
            $table->jsonb('condition_value');
            $table->jsonb('action_config')->nullable();
            $table->integer('priority')->default(0);
            $table->boolean('enabled')->default(true);
            $table->bigInteger('version')->default(1);
            $table->foreignUuid('created_by')->nullable()->references('id')->on('users');
            $table->timestamps();

            $table->index(['enabled', 'priority']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rules');
    }
};
