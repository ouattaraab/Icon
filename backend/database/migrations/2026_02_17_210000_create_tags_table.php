<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tags', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name')->unique();
            $table->string('color', 7)->default('#3b82f6'); // hex color
            $table->timestamps();
        });

        Schema::create('machine_tag', function (Blueprint $table) {
            $table->foreignUuid('machine_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('tag_id')->constrained()->cascadeOnDelete();
            $table->primary(['machine_id', 'tag_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('machine_tag');
        Schema::dropIfExists('tags');
    }
};
