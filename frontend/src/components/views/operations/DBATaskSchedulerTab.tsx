import React, { useState, useEffect, useCallback } from 'react';
import {
  CalendarCheck,
  CheckCircle,
  Clock,
  TrendingUp,
  Plus,
  RotateCcw,
  Trash2,
  Edit2,
  MessageSquare,
  AlertCircle,
} from 'lucide-react';
import { fetchData } from '../../../utils/api';
import { THEME, useAdaptiveTheme } from '../../../utils/theme';

const DBATaskSchedulerTab = () => {
    useAdaptiveTheme(); // keeps THEME in sync with dark/light toggle
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [expandedNotes, setExpandedNotes] = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [execHistory, setExecHistory] = useState([]);
  const [activeMainTab, setActiveMainTab] = useState('tasks'); // 'tasks' | 'approvals' | 'history'

  const [formData, setFormData] = useState({
    title: '',
    category: 'Daily',
    priority: 'medium',
    recurrence: 'daily',
    assignee: '',
    dueDate: '',
    notes: '',
  });

  // Load tasks on mount
  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchData('/api/tasks');
      setTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Failed to load tasks');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getAuthHeader = () => {
    const token = localStorage.getItem('pulsedb_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  };

  const handleAddTask = async () => {
    if (!formData.title.trim()) {
      alert('Title is required');
      return;
    }

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({
          title: formData.title,
          category: formData.category,
          priority: formData.priority,
          recurrence: formData.recurrence,
          assignee: formData.assignee || undefined,
          dueDate: formData.dueDate || undefined,
          notes: formData.notes || undefined,
        }),
      });

      if (!response.ok) throw new Error('Failed to create task');
      
      await loadTasks();
      resetForm();
      setShowAddForm(false);
    } catch (err) {
      alert('Error creating task: ' + err.message);
      console.error(err);
    }
  };

  const handleUpdateTask = async (id, updates) => {
    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: getAuthHeader(),
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error('Failed to update task');
      
      await loadTasks();
      setEditingId(null);
    } catch (err) {
      alert('Error updating task: ' + err.message);
      console.error(err);
    }
  };

  const handleDeleteTask = async (id) => {
    if (!confirm('Delete this task?')) return;

    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'DELETE',
        headers: getAuthHeader(),
      });

      if (!response.ok) throw new Error('Failed to delete task');
      
      await loadTasks();
    } catch (err) {
      alert('Error deleting task: ' + err.message);
      console.error(err);
    }
  };

  const handleReset = async () => {
    if (!confirm('Reset all tasks to defaults?')) return;

    try {
      const response = await fetch('/api/tasks/reset', {
        method: 'POST',
        headers: getAuthHeader(),
      });

      if (!response.ok) throw new Error('Failed to reset tasks');
      
      await loadTasks();
    } catch (err) {
      alert('Error resetting tasks: ' + err.message);
      console.error(err);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      category: 'Daily',
      priority: 'medium',
      recurrence: 'daily',
      assignee: '',
      dueDate: '',
      notes: '',
    });
  };

  const requiresApproval = (priority) => {
    return priority === 'critical' || priority === 'high';
  };

  const handleTaskExecution = (taskId, taskTitle) => {
    const now = new Date();
    const historyEntry = {
      id: `${taskId}-${Date.now()}`,
      taskId,
      taskTitle,
      startTime: now.toLocaleString(),
      timestamp: now.getTime(),
      duration: '0s',
      status: 'Running',
    };
    setExecHistory([historyEntry, ...execHistory]);
  };

  const updateHistoryStatus = (taskId, status) => {
    setExecHistory(prev =>
      prev.map(entry => {
        if (entry.taskId === taskId && entry.status === 'Running') {
          const duration = Math.round((Date.now() - entry.timestamp) / 1000);
          return { ...entry, status, duration: duration > 60 ? `${Math.floor(duration / 60)}m ${duration % 60}s` : `${duration}s` };
        }
        return entry;
      })
    );
  };

  const handleApproveTask = (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      handleTaskExecution(taskId, task.title);
      setPendingApprovals(pending => pending.filter(p => p !== taskId));
    }
  };

  const handleRejectTask = (taskId) => {
    setPendingApprovals(pending => pending.filter(p => p !== taskId));
  };

  const handleTaskRequestApproval = (taskId) => {
    if (!pendingApprovals.includes(taskId)) {
      setPendingApprovals([...pendingApprovals, taskId]);
    }
  };

  const getFilteredTasks = () => {
    let filtered = tasks;

    // Filter by recurrence/category
    if (filter === 'Daily') filtered = filtered.filter(t => t.recurrence === 'daily');
    else if (filter === 'Weekly') filtered = filtered.filter(t => t.recurrence === 'weekly');
    else if (filter === 'Monthly') filtered = filtered.filter(t => t.recurrence === 'monthly');
    else if (filter === 'Completed') filtered = filtered.filter(t => t.done);

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(t => 
        t.title.toLowerCase().includes(q) || 
        t.assignee?.toLowerCase().includes(q) ||
        t.notes?.toLowerCase().includes(q)
      );
    }

    return filtered;
  };

  const groupTasksByCategory = (taskList) => {
    const groups = {
      'Daily': [],
      'Weekly': [],
      'Monthly': [],
      'Ad-hoc': [],
    };

    taskList.forEach(task => {
      const category = task.category || 'Ad-hoc';
      if (groups[category]) {
        groups[category].push(task);
      }
    });

    return groups;
  };

  const isOverdue = (dueDate) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date() && !dueDate.endsWith('2099');
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return THEME.danger;
      case 'medium': return THEME.warning;
      case 'low': return THEME.success;
      default: return THEME.textMuted;
    }
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'Daily': return THEME.primary;
      case 'Weekly': return THEME.secondary;
      case 'Monthly': return THEME.ai;
      default: return THEME.textMuted;
    }
  };

  const filteredTasks = getFilteredTasks();
  const grouped = groupTasksByCategory(filteredTasks);
  const stats = {
    total: tasks.length,
    done: tasks.filter(t => t.done).length,
    pending: tasks.filter(t => !t.done).length,
  };

  return (
    <div style={styles.container}>
      <Styles />

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerTop}>
          <div style={styles.titleSection}>
            <CalendarCheck size={28} color={THEME.primary} />
            <h1 style={styles.title}>DBA Task Scheduler</h1>
          </div>
        </div>

        {/* Main Tab Buttons */}
        <div style={styles.mainTabsContainer}>
          <button
            onClick={() => setActiveMainTab('tasks')}
            style={{
              ...styles.mainTabButton,
              ...(activeMainTab === 'tasks' ? styles.mainTabButtonActive : {}),
            }}
          >
            Tasks
          </button>
          <button
            onClick={() => setActiveMainTab('approvals')}
            style={{
              ...styles.mainTabButton,
              ...(activeMainTab === 'approvals' ? styles.mainTabButtonActive : {}),
            }}
          >
            Pending Approval
            {pendingApprovals.length > 0 && (
              <span style={styles.badgeCount}>{pendingApprovals.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveMainTab('history')}
            style={{
              ...styles.mainTabButton,
              ...(activeMainTab === 'history' ? styles.mainTabButtonActive : {}),
            }}
          >
            Execution Log
          </button>
        </div>

        {/* Stats Row */}
        <div style={styles.statsRow}>
          <StatCard
            icon={<CalendarCheck size={20} />}
            label="Total Tasks"
            value={stats.total}
            color={THEME.primary}
          />
          <StatCard
            icon={<CheckCircle size={20} />}
            label="Completed"
            value={stats.done}
            color={THEME.success}
          />
          <StatCard
            icon={<Clock size={20} />}
            label="Pending"
            value={stats.pending}
            color={THEME.warning}
          />
          <StatCard
            icon={<TrendingUp size={20} />}
            label="Completion %"
            value={stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0}
            color={THEME.secondary}
            suffix="%"
          />
        </div>
      </div>

      {/* Controls Row */}
      <div style={styles.controlsRow}>
        <div style={styles.filterTabs}>
          {['All', 'Daily', 'Weekly', 'Monthly', 'Completed'].map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              style={{
                ...styles.filterTab,
                ...(filter === tab ? styles.filterTabActive : {}),
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.searchInput}
        />

        <button
          onClick={() => {
            setShowAddForm(!showAddForm);
            if (!showAddForm) resetForm();
          }}
          style={styles.addButton}
        >
          <Plus size={18} style={{ marginRight: 6 }} />
          Add Task
        </button>

        <button
          onClick={handleReset}
          style={styles.resetButton}
          title="Reset to defaults"
        >
          <RotateCcw size={18} />
        </button>
      </div>

      {/* Content based on active tab */}
      {activeMainTab === 'tasks' && (
        <>
      {/* Add Task Form */}
      {showAddForm && (
        <div style={styles.formContainer}>
          <h3 style={styles.formTitle}>New Task</h3>
          <div style={styles.formGrid}>
            <input
              type="text"
              placeholder="Task title (required)"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              style={styles.formInput}
            />

            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              style={styles.formSelect}
            >
              <option>Daily</option>
              <option>Weekly</option>
              <option>Monthly</option>
              <option>Ad-hoc</option>
            </select>

            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              style={styles.formSelect}
            >
              <option value="low">Priority: Low</option>
              <option value="medium">Priority: Medium</option>
              <option value="high">Priority: High</option>
            </select>

            <select
              value={formData.recurrence}
              onChange={(e) => setFormData({ ...formData, recurrence: e.target.value })}
              style={styles.formSelect}
            >
              <option value="once">Once</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>

            <input
              type="text"
              placeholder="Assignee (optional)"
              value={formData.assignee}
              onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
              style={styles.formInput}
            />

            <input
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              style={styles.formInput}
            />

            <textarea
              placeholder="Notes (optional)"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              style={{ ...styles.formInput, gridColumn: '1 / -1', minHeight: 80 }}
            />
          </div>

          <div style={styles.formActions}>
            <button onClick={handleAddTask} style={styles.saveButton}>
              Save Task
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                resetForm();
              }}
              style={styles.cancelButton}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tasks List */}
      {loading ? (
        <div style={styles.loadingState}>Loading tasks...</div>
      ) : error ? (
        <div style={styles.errorState}>
          <AlertCircle size={20} color={THEME.danger} />
          {error}
        </div>
      ) : filteredTasks.length === 0 ? (
        <div style={styles.emptyState}>
          No tasks found. {search && 'Try adjusting your search.'}
        </div>
      ) : (
        <div style={styles.tasksList}>
          {Object.entries(grouped).map(([category, categoryTasks]) =>
            categoryTasks.length > 0 ? (
              <div key={category} style={styles.categoryGroup}>
                <div
                  style={{
                    ...styles.categoryHeader,
                    borderLeftColor: getCategoryColor(category),
                  }}
                >
                  <span style={styles.categoryName}>{category}</span>
                  <span style={styles.categoryCount}>{categoryTasks.length}</span>
                </div>

                {categoryTasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    isEditing={editingId === task.id}
                    onToggleDone={() =>
                      handleUpdateTask(task.id, { done: !task.done })
                    }
                    onEdit={() => setEditingId(task.id)}
                    onDelete={() => handleDeleteTask(task.id)}
                    onUpdate={(updates) => {
                      handleUpdateTask(task.id, updates);
                      setEditingId(null);
                    }}
                    onCancelEdit={() => setEditingId(null)}
                    isOverdue={isOverdue(task.dueDate)}
                    getPriorityColor={getPriorityColor}
                    expandedNotes={expandedNotes}
                    setExpandedNotes={setExpandedNotes}
                    requiresApproval={requiresApproval(task.priority)}
                    onRequestApproval={() => handleTaskRequestApproval(task.id)}
                  />
                ))}
              </div>
            ) : null
          )}
        </div>
      )}
        </>
      )}

      {/* Pending Approvals Tab */}
      {activeMainTab === 'approvals' && (
        <div style={styles.panelContainer}>
          <h2 style={styles.panelTitle}>Tasks Pending Approval</h2>
          {pendingApprovals.length === 0 ? (
            <div style={styles.emptyPanelState}>
              <div style={styles.checkmarkIcon}>✅</div>
              <div>No tasks pending approval</div>
            </div>
          ) : (
            <div style={styles.approvalsList}>
              {tasks
                .filter(task => pendingApprovals.includes(task.id) && requiresApproval(task.priority))
                .map(task => (
                  <div key={task.id} style={styles.approvalCard}>
                    <div style={styles.approvalRiskBanner}>
                      <span>⚠️ This is a high-risk task. Review before approving.</span>
                    </div>
                    <div style={styles.approvalContent}>
                      <div style={styles.approvalHeader}>
                        <div>
                          <div style={styles.approvalTaskTitle}>{task.title}</div>
                          <div style={styles.approvalTaskMeta}>
                            <span style={styles.approvalCategory}>{task.category}</span>
                            <span
                              style={{
                                ...styles.approvalPriorityBadge,
                                backgroundColor: task.priority === 'critical' ? THEME.danger : THEME.danger,
                                color: THEME.textInverse,
                              }}
                            >
                              {task.priority.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div style={styles.approvalActions}>
                        <button
                          onClick={() => handleApproveTask(task.id)}
                          style={styles.approveButton}
                        >
                          ✓ Approve
                        </button>
                        <button
                          onClick={() => handleRejectTask(task.id)}
                          style={styles.rejectButton}
                        >
                          ✕ Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Execution Log Tab */}
      {activeMainTab === 'history' && (
        <div style={styles.panelContainer}>
          <h2 style={styles.panelTitle}>Task Execution History</h2>
          {execHistory.length === 0 ? (
            <div style={styles.emptyPanelState}>
              <div style={styles.historyIcon}>📋</div>
              <div>No execution history yet. Run a task to see history here.</div>
            </div>
          ) : (
            <div style={styles.historyTable}>
              <div style={styles.historyHeader}>
                <div style={styles.historyCol1}>Task Name</div>
                <div style={styles.historyCol2}>Start Time</div>
                <div style={styles.historyCol3}>Duration</div>
                <div style={styles.historyCol4}>Status</div>
              </div>
              {execHistory.map(entry => (
                <div key={entry.id} style={styles.historyRow}>
                  <div style={styles.historyCol1}>{entry.taskTitle}</div>
                  <div style={styles.historyCol2}>{entry.startTime}</div>
                  <div style={styles.historyCol3}>{entry.duration}</div>
                  <div style={styles.historyCol4}>
                    <span
                      style={{
                        ...styles.statusBadge,
                        backgroundColor:
                          entry.status === 'Success'
                            ? `${THEME.success}30`
                            : entry.status === 'Failed'
                            ? `${THEME.danger}30`
                            : `${THEME.warning}30`,
                        color:
                          entry.status === 'Success'
                            ? THEME.success
                            : entry.status === 'Failed'
                            ? THEME.danger
                            : THEME.warning,
                      }}
                    >
                      {entry.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const StatCard = ({ icon, label, value, color, suffix = '' }) => {
  return (
    <div style={styles.statCard}>
      <div style={{ ...styles.statIcon, color }}>
        {icon}
      </div>
      <div style={styles.statContent}>
        <div style={styles.statLabel}>{label}</div>
        <div style={{ ...styles.statValue, color }}>
          {value}{suffix}
        </div>
      </div>
    </div>
  );
};

const TaskRow = ({
  task,
  isEditing,
  onToggleDone,
  onEdit,
  onDelete,
  onUpdate,
  onCancelEdit,
  isOverdue,
  getPriorityColor,
  expandedNotes,
  setExpandedNotes,
  requiresApproval,
  onRequestApproval,
}) => {
  const [editForm, setEditForm] = useState(task);

  const handleSaveEdit = () => {
    onUpdate(editForm);
  };

  if (isEditing) {
    return (
      <div style={styles.taskRowEdit}>
        <div style={styles.editFormInline}>
          <input
            type="text"
            value={editForm.title}
            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
            style={styles.editInput}
            placeholder="Task title"
          />
          <select
            value={editForm.priority}
            onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
            style={styles.editSelect}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <input
            type="text"
            value={editForm.assignee || ''}
            onChange={(e) => setEditForm({ ...editForm, assignee: e.target.value })}
            style={styles.editInput}
            placeholder="Assignee"
          />
          <input
            type="date"
            value={editForm.dueDate || ''}
            onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
            style={styles.editInput}
          />
          <textarea
            value={editForm.notes || ''}
            onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
            style={{ ...styles.editInput, minHeight: 60 }}
            placeholder="Notes"
          />
          <div style={styles.editActions}>
            <button onClick={handleSaveEdit} style={styles.editSaveBtn}>
              Save
            </button>
            <button onClick={onCancelEdit} style={styles.editCancelBtn}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.taskRow}>
      <div style={styles.taskMainRow}>
        <input
          type="checkbox"
          checked={task.done || false}
          onChange={onToggleDone}
          style={styles.taskCheckbox}
        />

        <div
          style={{
            ...styles.priorityDot,
            backgroundColor: getPriorityColor(task.priority),
          }}
        />

        <div style={styles.taskContent}>
          <div style={styles.taskTitleRow}>
            <div
              style={{
                ...styles.taskTitle,
                textDecoration: task.done ? 'line-through' : 'none',
                opacity: task.done ? 0.6 : 1,
              }}
            >
              {task.title}
            </div>
            {requiresApproval && (
              <span style={styles.approvalRequiredBadge}>⚠️ Requires Approval</span>
            )}
          </div>
          <div style={styles.taskMeta}>
            {task.recurrence && (
              <span style={styles.recurrenceBadge}>{task.recurrence}</span>
            )}
            {task.assignee && (
              <span style={styles.assigneeBadge}>{task.assignee}</span>
            )}
            {task.dueDate && (
              <span
                style={{
                  ...styles.dueDateBadge,
                  color: isOverdue ? THEME.danger : THEME.textMuted,
                }}
              >
                {new Date(task.dueDate).toLocaleDateString()}
                {isOverdue && ' (overdue)'}
              </span>
            )}
          </div>
        </div>

        {task.notes && (
          <button
            onClick={() =>
              setExpandedNotes(expandedNotes === task.id ? null : task.id)
            }
            style={styles.notesButton}
            title="View notes"
          >
            <MessageSquare size={16} />
          </button>
        )}

        <button onClick={onEdit} style={styles.editButton}>
          <Edit2 size={16} />
        </button>

        <button onClick={onDelete} style={styles.deleteButton}>
          <Trash2 size={16} />
        </button>
      </div>

      {expandedNotes === task.id && task.notes && (
        <div style={styles.notesExpandedContainer}>
          <div style={styles.notesExpanded}>{task.notes}</div>
        </div>
      )}
    </div>
  );
};

const Styles = () => (
  <style>{`
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .task-fade-in {
      animation: fadeIn 0.3s ease-in-out;
    }

    div[style*="border-left: 4px"]::before {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      width: 40%;
      height: 100%;
      background: repeating-linear-gradient(-45deg, transparent, transparent 8px, ${THEME.glassBorder}15 8px, ${THEME.glassBorder}15 9px);
      pointer-events: none;
    }
  `}</style>
);

const styles = {
  container: {
    padding: '24px',
    backgroundColor: THEME.bg,
    color: THEME.textMain,
    fontFamily: THEME.fontBody,
    minHeight: '100vh',
  },

  header: {
    marginBottom: 32,
  },

  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },

  titleSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 18,
  },

  title: {
    fontSize: 28,
    fontWeight: 700,
    margin: 0,
    color: THEME.textMain,
    letterSpacing: '-0.5px',
  },

  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 22,
  },

  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 22,
    padding: 16,
    backgroundColor: THEME.surface,
    border: 'none',
    borderLeft: `4px solid ${THEME.primary}`,
    borderRadius: '0 8px 8px 0',
    transition: 'all 0.2s ease',
    cursor: 'default',
    boxShadow: THEME.shadowSm,
    position: 'relative',
    overflow: 'hidden',
  },

  statIcon: {
    fontSize: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  statContent: {
    flex: 1,
  },

  statLabel: {
    fontSize: 12,
    color: THEME.textMuted,
    
    letterSpacing: '0.5px',
    marginBottom: 4,
    fontWeight: 500,
  },

  statValue: {
    fontSize: 22,
    fontWeight: 700,
    fontFamily: THEME.fontMono,
  },

  controlsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 22,
    marginBottom: 32,
    flexWrap: 'wrap',
  },

  filterTabs: {
    display: 'flex',
    gap: 20,
    flex: 1,
    minWidth: 200,
  },

  filterTab: {
    padding: '14px 20px',
    backgroundColor: 'transparent',
    border: `1px solid ${THEME.glassBorder}`,
    color: THEME.textMuted,
    borderRadius: 16,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    transition: 'all 0.2s ease',
    fontFamily: THEME.fontBody,
  },

  filterTabActive: {
    backgroundColor: THEME.surface,
    color: THEME.primary,
    borderColor: THEME.primary,
    
  },

  searchInput: {
    padding: '20px 24px',
    backgroundColor: THEME.surface,
    border: `1px solid ${THEME.glassBorder}`,
    color: THEME.textMain,
    borderRadius: 16,
    fontSize: 13,
    minWidth: 180,
    transition: 'all 0.2s ease',
    fontFamily: THEME.fontBody,
  },

  addButton: {
    display: 'flex',
    alignItems: 'center',
    padding: '14px 20px',
    backgroundColor: THEME.primaryDark,
    border: 'none',
    color: THEME.textInverse,
    borderRadius: 16,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    transition: 'all 0.2s ease',
    fontFamily: THEME.fontBody,
  },

  resetButton: {
    padding: '20px 24px',
    backgroundColor: 'transparent',
    border: `1px solid ${THEME.textMuted}40`,
    color: THEME.textMuted,
    borderRadius: 16,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.2s ease',
    fontFamily: THEME.fontBody,
  },

  formContainer: {
    padding: 24,
    backgroundColor: THEME.surface,
    border: `1px solid ${THEME.glassBorder}`,
    borderRadius: 16,
    marginBottom: 32,
    animation: 'slideIn 0.3s ease-out',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    backdropFilter: 'blur(12px)',
  },

  formTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: THEME.textMain,
    margin: '0 0 16px 0',
  },

  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: 22,
    marginBottom: 20,
  },

  formInput: {
    padding: '22px 28px',
    backgroundColor: THEME.surfaceHover,
    border: `1px solid ${THEME.glassBorder}`,
    color: THEME.textMain,
    borderRadius: 18,
    fontSize: 13,
    fontFamily: THEME.fontBody,
    transition: 'all 0.2s ease',
  },

  formSelect: {
    padding: '22px 28px',
    backgroundColor: THEME.surfaceHover,
    border: `1px solid ${THEME.glassBorder}`,
    color: THEME.textMain,
    borderRadius: 18,
    fontSize: 13,
    fontFamily: THEME.fontBody,
    transition: 'all 0.2s ease',
  },

  formActions: {
    display: 'flex',
    gap: 20,
    justifyContent: 'flex-end',
  },

  saveButton: {
    padding: '10px 24px',
    backgroundColor: THEME.primaryDark,
    border: 'none',
    color: THEME.textInverse,
    borderRadius: 18,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    transition: 'all 0.2s ease',
    fontFamily: THEME.fontBody,
  },

  cancelButton: {
    padding: '10px 24px',
    backgroundColor: 'transparent',
    border: `1px solid ${THEME.textMuted}40`,
    color: THEME.textMuted,
    borderRadius: 18,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    transition: 'all 0.2s ease',
    fontFamily: THEME.fontBody,
  },

  loadingState: {
    textAlign: 'center',
    padding: 40,
    color: THEME.textMuted,
    fontSize: 14,
  },

  errorState: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    padding: 18,
    backgroundColor: `${THEME.danger}20`,
    border: `1px solid ${THEME.danger}40`,
    color: THEME.danger,
    borderRadius: 18,
    marginBottom: 20,
    fontSize: 13,
  },

  emptyState: {
    textAlign: 'center',
    padding: 60,
    color: THEME.textMuted,
    fontSize: 14,
  },

  tasksList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },

  categoryGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },

  categoryHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    padding: '14px 20px',
    backgroundColor: THEME.surfaceHover,
    borderRadius: 18,
    borderLeft: '4px solid',
    marginBottom: 12,
  },

  categoryName: {
    fontSize: 14,
    fontWeight: 600,
    color: THEME.textMain,
    flex: 1,
  },

  categoryCount: {
    fontSize: 12,
    color: THEME.textMuted,
    backgroundColor: THEME.surface,
    padding: '2px 8px',
    borderRadius: 20,
    fontWeight: 500,
    fontFamily: THEME.fontMono,
  },

  taskRow: {
    display: 'flex',
    flexDirection: 'column',
    padding: 16,
    backgroundColor: THEME.surface,
    border: 'none',
    borderLeft: `4px solid ${THEME.primary}`,
    borderRadius: '0 12px 12px 0',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    backdropFilter: 'blur(12px)',
    position: 'relative',
    overflow: 'hidden',
  },

  taskMainRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
  },

  taskCheckbox: {
    width: 18,
    height: 18,
    cursor: 'pointer',
    accentColor: THEME.primary,
  },

  priorityDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },

  taskContent: {
    flex: 1,
    minWidth: 0,
  },

  taskTitle: {
    fontSize: 14,
    fontWeight: 500,
    color: THEME.textMain,
    marginBottom: 4,
    wordBreak: 'break-word',
  },

  taskMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    flexWrap: 'wrap',
  },

  recurrenceBadge: {
    display: 'inline-block',
    fontSize: 11,
    backgroundColor: `${THEME.primary}20`,
    color: THEME.primary,
    padding: '2px 8px',
    borderRadius: 16,
    fontWeight: 500,
    textTransform: 'capitalize',
  },

  assigneeBadge: {
    display: 'inline-block',
    fontSize: 11,
    backgroundColor: `${THEME.secondary}20`,
    color: THEME.secondary,
    padding: '2px 8px',
    borderRadius: 16,
    fontWeight: 500,
  },

  dueDateBadge: {
    display: 'inline-block',
    fontSize: 11,
    backgroundColor: `${THEME.textMuted}10`,
    padding: '2px 8px',
    borderRadius: 16,
    fontWeight: 500,
  },

  notesButton: {
    padding: 6,
    backgroundColor: 'transparent',
    border: `1px solid ${THEME.glassBorder}`,
    color: THEME.textMuted,
    borderRadius: 20,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },

  editButton: {
    padding: 6,
    backgroundColor: 'transparent',
    border: `1px solid ${THEME.glassBorder}`,
    color: THEME.textMuted,
    borderRadius: 20,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },

  deleteButton: {
    padding: 6,
    backgroundColor: 'transparent',
    border: `1px solid ${THEME.glassBorder}`,
    color: THEME.danger,
    borderRadius: 20,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },

  notesExpandedContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTop: `1px solid ${THEME.glassBorder}`,
  },

  notesExpanded: {
    fontSize: 12,
    color: THEME.textMuted,
    lineHeight: 1.6,
    padding: '10px',
    backgroundColor: THEME.surfaceHover,
    borderRadius: 18,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },

  taskRowEdit: {
    padding: 16,
    backgroundColor: THEME.surface,
    border: `2px solid ${THEME.primary}`,
    borderRadius: 18,
  },

  editFormInline: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: 18,
  },

  editInput: {
    padding: '22px 28px',
    backgroundColor: THEME.surfaceHover,
    border: `1px solid ${THEME.glassBorder}`,
    color: THEME.textMain,
    borderRadius: 18,
    fontSize: 12,
    fontFamily: THEME.fontBody,
  },

  editSelect: {
    padding: '22px 28px',
    backgroundColor: THEME.surfaceHover,
    border: `1px solid ${THEME.glassBorder}`,
    color: THEME.textMain,
    borderRadius: 18,
    fontSize: 12,
    fontFamily: THEME.fontBody,
  },

  editActions: {
    display: 'flex',
    gap: 22,
    gridColumn: '1 / -1',
    justifyContent: 'flex-end',
    marginTop: 12,
  },

  editSaveBtn: {
    padding: '14px 20px',
    backgroundColor: THEME.success,
    border: 'none',
    color: THEME.textInverse,
    borderRadius: 18,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    transition: 'all 0.2s ease',
    fontFamily: THEME.fontBody,
  },

  editCancelBtn: {
    padding: '14px 20px',
    backgroundColor: 'transparent',
    border: `1px solid ${THEME.textMuted}40`,
    color: THEME.textMuted,
    borderRadius: 18,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    transition: 'all 0.2s ease',
    fontFamily: THEME.fontBody,
  },

  mainTabsContainer: {
    display: 'flex',
    gap: 22,
    marginTop: 20,
    borderBottom: `1px solid ${THEME.glassBorder}`,
    paddingBottom: 14,
  },

  mainTabButton: {
    padding: '10px 18px',
    backgroundColor: 'transparent',
    border: 'none',
    color: THEME.textMuted,
    borderRadius: 0,
    borderBottom: `2px solid transparent`,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    transition: 'all 0.2s ease',
    fontFamily: THEME.fontBody,
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    position: 'relative',
  },

  mainTabButtonActive: {
    color: THEME.primary,
    borderBottomColor: THEME.primary,
  },

  badgeCount: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 20,
    height: 20,
    backgroundColor: THEME.danger,
    color: THEME.textInverse,
    borderRadius: '50%',
    fontSize: 11,
    fontWeight: 700,
    marginLeft: 4,
  },

  panelContainer: {
    marginTop: 24,
  },

  panelTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: THEME.textMain,
    margin: '0 0 20px 0',
  },

  emptyPanelState: {
    textAlign: 'center',
    padding: 60,
    color: THEME.textMuted,
    fontSize: 14,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 18,
  },

  checkmarkIcon: {
    fontSize: 40,
    marginBottom: 8,
  },

  historyIcon: {
    fontSize: 40,
    marginBottom: 8,
  },

  approvalsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 22,
  },

  approvalCard: {
    backgroundColor: THEME.surface,
    border: 'none',
    borderLeft: `4px solid ${THEME.primary}`,
    borderRadius: '0 8px 8px 0',
    overflow: 'hidden',
    boxShadow: THEME.shadowSm,
    position: 'relative',
  },

  approvalRiskBanner: {
    padding: '18px 22px',
    backgroundColor: `${THEME.danger}15`,
    borderBottom: `1px solid ${THEME.danger}30`,
    color: THEME.danger,
    fontSize: 13,
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: 20,
  },

  approvalContent: {
    padding: '16px',
  },

  approvalHeader: {
    marginBottom: 16,
  },

  approvalTaskTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: THEME.textMain,
    marginBottom: 8,
  },

  approvalTaskMeta: {
    display: 'flex',
    gap: 20,
    alignItems: 'center',
  },

  approvalCategory: {
    fontSize: 12,
    backgroundColor: `${THEME.primary}20`,
    color: THEME.primary,
    padding: '2px 8px',
    borderRadius: 16,
    fontWeight: 500,
  },

  approvalPriorityBadge: {
    fontSize: 11,
    padding: '4px 10px',
    borderRadius: 16,
    fontWeight: 600,
    
  },

  approvalActions: {
    display: 'flex',
    gap: 22,
  },

  approveButton: {
    flex: 1,
    padding: '14px 20px',
    backgroundColor: THEME.success,
    border: 'none',
    color: THEME.textInverse,
    borderRadius: 16,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    transition: 'all 0.2s ease',
    fontFamily: THEME.fontBody,
  },

  rejectButton: {
    flex: 1,
    padding: '14px 20px',
    backgroundColor: THEME.danger,
    border: 'none',
    color: THEME.textInverse,
    borderRadius: 16,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    transition: 'all 0.2s ease',
    fontFamily: THEME.fontBody,
  },

  historyTable: {
    backgroundColor: THEME.surface,
    border: `1px solid ${THEME.glassBorder}`,
    borderRadius: 20,
    overflow: 'hidden',
  },

  historyHeader: {
    display: 'grid',
    gridTemplateColumns: '2fr 1.5fr 1fr 1fr',
    gap: 0,
    padding: '18px 22px',
    backgroundColor: THEME.surfaceHover,
    borderBottom: `1px solid ${THEME.glassBorder}`,
    fontWeight: 600,
    fontSize: 13,
    color: THEME.textMuted,
    
    letterSpacing: '0.5px',
  },

  historyRow: {
    display: 'grid',
    gridTemplateColumns: '2fr 1.5fr 1fr 1fr',
    gap: 0,
    padding: '18px 22px',
    borderBottom: `1px solid ${THEME.glassBorder}`,
    alignItems: 'center',
    fontSize: 13,
    color: THEME.textMain,
  },

  historyCol1: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  historyCol2: {
    fontSize: 12,
    color: THEME.textMuted,
  },

  historyCol3: {
    fontSize: 12,
    color: THEME.textMuted,
    fontFamily: THEME.fontMono,
  },

  historyCol4: {
    display: 'flex',
    alignItems: 'center',
  },

  statusBadge: {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    
  },

  taskTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 22,
    flexWrap: 'wrap',
  },

  approvalRequiredBadge: {
    display: 'inline-block',
    fontSize: 11,
    backgroundColor: `${THEME.danger}20`,
    color: THEME.danger,
    padding: '2px 8px',
    borderRadius: 16,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
};

export default DBATaskSchedulerTab;