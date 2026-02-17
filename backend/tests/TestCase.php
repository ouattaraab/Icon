<?php

namespace Tests;

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Ensure APP_ENV=testing before the application boots.
     * Required when running tests inside Docker where the container
     * env var (APP_ENV=local) may override phpunit.xml settings.
     */
    public function createApplication(): Application
    {
        putenv('APP_ENV=testing');
        $_ENV['APP_ENV'] = 'testing';
        $_SERVER['APP_ENV'] = 'testing';

        return parent::createApplication();
    }
}
