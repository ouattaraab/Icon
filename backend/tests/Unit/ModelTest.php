<?php

namespace Tests\Unit;

use App\Models\User;
use PHPUnit\Framework\TestCase;

class ModelTest extends TestCase
{
    public function test_user_is_admin(): void
    {
        $user = new User(['role' => 'admin']);
        $this->assertTrue($user->isAdmin());

        $user = new User(['role' => 'viewer']);
        $this->assertFalse($user->isAdmin());
    }

    public function test_user_is_manager(): void
    {
        $admin = new User(['role' => 'admin']);
        $this->assertTrue($admin->isManager());

        $manager = new User(['role' => 'manager']);
        $this->assertTrue($manager->isManager());

        $viewer = new User(['role' => 'viewer']);
        $this->assertFalse($viewer->isManager());
    }

    public function test_rule_to_agent_format(): void
    {
        $rule = new \App\Models\Rule([
            'name' => 'Block passwords',
            'version' => 3,
            'category' => 'block',
            'target' => 'prompt',
            'condition_type' => 'regex',
            'condition_value' => ['pattern' => 'password|mot de passe', 'flags' => 'i'],
            'action_config' => ['message' => 'Contenu bloqué', 'severity' => 'critical'],
            'priority' => 10,
            'enabled' => true,
        ]);
        $rule->id = 'test-uuid';

        $format = $rule->toAgentFormat();

        $this->assertEquals('test-uuid', $format['id']);
        $this->assertEquals('block', $format['category']);
        $this->assertEquals('prompt', $format['target']);
        $this->assertEquals('regex', $format['condition']['type']);
        $this->assertEquals('password|mot de passe', $format['condition']['pattern']);
        $this->assertEquals(10, $format['priority']);
        $this->assertTrue($format['enabled']);
    }
}
