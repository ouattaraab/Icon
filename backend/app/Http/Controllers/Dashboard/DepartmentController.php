<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Department;
use App\Models\Machine;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DepartmentController extends Controller
{
    public function index(Request $request): Response
    {
        $departments = Department::query()
            ->when($request->query('search'), fn ($q, $search) => $q->where('name', 'ilike', "%{$search}%")
                ->orWhere('manager_name', 'ilike', "%{$search}%")
            )
            ->orderBy('name')
            ->paginate(25);

        // Provide all machines (id + hostname) for the assign modal
        $machines = Machine::orderBy('hostname')
            ->get(['id', 'hostname', 'department_id']);

        return Inertia::render('Departments/Index', [
            'departments' => $departments,
            'machines' => $machines,
            'filters' => $request->only(['search']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:departments,name',
            'description' => 'nullable|string|max:5000',
            'manager_name' => 'nullable|string|max:255',
        ]);

        $department = Department::create($validated);

        AuditLog::log('department.created', 'Department', $department->id, [
            'name' => $department->name,
        ]);

        return redirect()->route('departments.index')
            ->with('success', "Departement \u00ab {$department->name} \u00bb cree.");
    }

    public function update(Request $request, Department $department): RedirectResponse
    {
        $validated = $request->validate([
            'name' => "required|string|max:255|unique:departments,name,{$department->id}",
            'description' => 'nullable|string|max:5000',
            'manager_name' => 'nullable|string|max:255',
        ]);

        $changes = [];
        foreach (['name', 'description', 'manager_name'] as $field) {
            if (array_key_exists($field, $validated) && $validated[$field] !== $department->$field) {
                $changes[$field] = ['old' => $department->$field, 'new' => $validated[$field]];
            }
        }

        $department->update($validated);

        if (! empty($changes)) {
            AuditLog::log('department.updated', 'Department', $department->id, [
                'name' => $department->name,
                'changes' => $changes,
            ]);
        }

        return redirect()->route('departments.index')
            ->with('success', "Departement \u00ab {$department->name} \u00bb mis a jour.");
    }

    public function destroy(Department $department): RedirectResponse
    {
        if ($department->machines()->exists()) {
            return redirect()->route('departments.index')
                ->with('error', "Impossible de supprimer le departement \u00ab {$department->name} \u00bb car des machines y sont assignees.");
        }

        $name = $department->name;
        $departmentId = $department->id;

        $department->delete();

        AuditLog::log('department.deleted', 'Department', $departmentId, ['name' => $name]);

        return redirect()->route('departments.index')
            ->with('success', "Departement \u00ab {$name} \u00bb supprime.");
    }

    public function assignMachines(Request $request, Department $department): RedirectResponse
    {
        $validated = $request->validate([
            'machine_ids' => 'required|array|min:1',
            'machine_ids.*' => 'uuid|exists:machines,id',
        ]);

        // Remove machines from their previous department count
        $previousDepartmentIds = Machine::whereIn('id', $validated['machine_ids'])
            ->whereNotNull('department_id')
            ->pluck('department_id')
            ->unique();

        // Assign machines to this department
        Machine::whereIn('id', $validated['machine_ids'])
            ->update(['department_id' => $department->id]);

        // Recompute counts for affected departments
        $department->updateMachineCount();
        foreach ($previousDepartmentIds as $depId) {
            if ($depId !== $department->id) {
                Department::find($depId)?->updateMachineCount();
            }
        }

        $count = count($validated['machine_ids']);

        AuditLog::log('department.machines_assigned', 'Department', $department->id, [
            'name' => $department->name,
            'machine_count' => $count,
        ]);

        return redirect()->route('departments.index')
            ->with('success', "{$count} machine(s) assignee(s) au departement \u00ab {$department->name} \u00bb.");
    }
}
