let calendar;
let notifiedTasks = new Set(); // Track which tasks have been notified

document.addEventListener('DOMContentLoaded', function () {
  // Load dark mode preference
  const isDarkMode = localStorage.getItem('darkMode') === 'true';
  if (isDarkMode) {
    document.body.classList.add('dark-mode');
  }
  
  // Initialize calendar
  let calendarEl = document.getElementById('calendar');
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    height: "auto"
  });
  calendar.render();
  
  // Load tasks and populate calendar
  displayTasks();
  loadCalendarEvents();
  
  // Check for missed tasks on load and every minute
  checkForMissedTasks();
  setInterval(checkForMissedTasks, 60 * 1000);
  
  // Request notification permission
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
  
  // Check for upcoming deadlines every 5 minutes
  checkForUpcomingDeadlines();
  setInterval(checkForUpcomingDeadlines, 5* 60 * 1000); // 5 minutes
});


function convertTo24Hour(hour, ampm) {
  hour = parseInt(hour);
  if (ampm === "AM") {
    return hour === 12 ? 0 : hour;
  } else {
    return hour === 12 ? 12 : hour + 12;
  }
}

function getPriorityColor(priority) {
  if (priority === "High") return "red";
  if (priority === "Medium") return "orange";
  if (priority === "Low") return "green";
  return "blue";
}

function loadCalendarEvents() {
  // Clear existing events
  calendar.removeAllEvents();
  
  fetch("https://smart-task-scheduler-a7h9.onrender.com/tasks")
    .then(res => res.json())
    .then(tasks => {
      tasks.forEach(task => {
        // Use today's date or the stored date
        const today = new Date().toISOString().split('T')[0];
        const eventDate = task.date || today;
        
        const hour = task.deadline;
        const startTime = `${String(hour).padStart(2, '0')}:00`;
        const endTime = `${String(hour + task.duration).padStart(2, '0')}:00`;

        const status = task.status || (task.completed ? "completed" : "pending");

        // Color by status first, then priority
        let eventColor;
        if (status === "missed") {
          eventColor = "#6b7280"; // grey
        } else if (status === "late") {
          eventColor = "#f59e0b"; // amber
        } else if (task.completed) {
          eventColor = "#10b981"; // green tick
        } else {
          eventColor = getPriorityColor(task.priority);
        }

        const titlePrefix = status === "missed" ? "✗ " : status === "late" ? "⚠ " : "";

        calendar.addEvent({
          title: titlePrefix + task.name,
          start: `${eventDate}T${startTime}`,
          end: `${eventDate}T${endTime}`,
          color: eventColor
        });
      });
    })
    .catch(err => console.error("Error loading calendar events: " + err));
}

function addTask() {
  const name = document.getElementById("name").value;
  const deadlineDate = document.getElementById("deadline-date").value;
  const deadlineHour = document.getElementById("deadline-hour").value;
  const deadlineAmpm = document.getElementById("deadline-ampm").value;
  const priority = document.getElementById("priority").value;

  if (!name || !deadlineDate || !deadlineHour || !deadlineAmpm || !priority) {
    alert("Please fill in all fields");
    return;
  }

  const deadline24 = convertTo24Hour(deadlineHour, deadlineAmpm);
  const defaultDuration = 1;

  fetch("https://smart-task-scheduler-a7h9.onrender.com/add-task", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: name,
      duration: defaultDuration,
      deadline: deadline24,
      priority: priority,
      date: deadlineDate
    })
  })
  .then(res => res.json())
  .then(data => {
    console.log(data.message);
    
    document.getElementById("name").value = "";
    document.getElementById("deadline-date").value = "";
    document.getElementById("deadline-hour").value = "";
    document.getElementById("deadline-ampm").value = "";
    document.getElementById("priority").value = "";
    displayTasks();
    loadCalendarEvents();
  })
  .catch(err => alert("Error adding task: " + err));
}

function displayTasks() {
  fetch("https://smart-task-scheduler-a7h9.onrender.com/tasks")
    .then(res => res.json())
    .then(tasks => {
      let taskList = document.getElementById("taskList");
      if (!taskList) {
        taskList = document.createElement("div");
        taskList.id = "taskList";
        document.querySelector(".form").after(taskList);
      }
      taskList.innerHTML = "<h2>Added Tasks:</h2>";
      if (tasks.length === 0) {
        taskList.innerHTML += "<p>No tasks added yet</p>";
        return;
      }
      tasks.forEach(task => {
        const hour = task.deadline;
        const ampm = hour >= 12 ? "PM" : "AM";
        const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
        const status = task.status || (task.completed ? "completed" : "pending");
        const isCompleted = task.completed ? "completed" : "";
        const progress = task.progress || 0;

        // Status badge
        const statusBadgeMap = {
          completed: `<span class="status-badge status-completed">✓ Completed</span>`,
          late:      `<span class="status-badge status-late">⚠ Late</span>`,
          missed:    `<span class="status-badge status-missed">✗ Missed</span>`,
          pending:   ""
        };
        const statusBadge = statusBadgeMap[status] || "";

        // Show delete for completed/late/missed; show complete btn for all non-missed, or undo if done
        const canComplete = status !== "missed";
        const completeLabel = task.completed ? "Undo" : (status === "missed" ? "" : "Complete");
        const completeBtn = canComplete
          ? `<button class="task-complete-btn" onclick="completeTask(${task.id})">${completeLabel}</button>`
          : `<button class="task-complete-btn task-late-btn" onclick="completeTask(${task.id})">Mark Late</button>`;
        const deleteBtn = (task.completed || status === "missed")
          ? `<button class="task-delete-btn" onclick="deleteTask(${task.id})">Delete</button>`
          : "";
        
        let taskHTML = `<div class="task-item ${isCompleted} status-${status}">
          <div class="task-container">
            <div class="task-text">
              <strong>${task.name}</strong> — Deadline: ${displayHour}:00 ${ampm}, Priority: ${task.priority}
              ${statusBadge}
            </div>
            <div class="task-buttons">
              ${completeBtn}
              <button class="task-edit-btn" onclick="openEditModal(${task.id}, '${task.name}', ${task.deadline}, '${task.priority}')">Edit</button>
              ${deleteBtn}
            </div>
          </div>
          <div class="task-progress-container">
            <div class="progress-bar-wrapper">
              <input type="range" min="0" max="100" value="${progress}" class="progress-slider" onchange="updateTaskProgress(${task.id}, this.value)">
              <span class="progress-text">${progress}%</span>
            </div>
            <div class="progress-bar" style="width: 100%;">
              <div class="progress-bar-fill" style="width: ${progress}%;"></div>
            </div>
          </div>
        </div>`;
        
        taskList.innerHTML += taskHTML;
      });
    })
    .catch(err => alert("Error fetching tasks: " + err));
}


function schedule() {
  const today = new Date().toISOString().split('T')[0];
  fetch("https://smart-task-scheduler-a7h9.onrender.com/schedule")
    .then(res => res.json())
    .then(data => {
      calendar.removeAllEvents();
      data.scheduled.forEach(task => {
        calendar.addEvent({
          title: task.title,
          start: `${today}T${task.start}:00`,
          end: `${today}T${task.end}:00`,
          color: task.color
        });
      });
    })
    .catch(err => alert("Error scheduling tasks: " + err));
}

function toggleNightMode() {
  document.body.classList.toggle('dark-mode');
  const isDarkMode = document.body.classList.contains('dark-mode');
  localStorage.setItem('darkMode', isDarkMode);
}

function completeTask(taskId) {
  fetch(`https://smart-task-scheduler-a7h9.onrender.com/complete-task/${taskId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" }
  })
  .then(res => res.json())
  .then(data => {
    console.log(data.message);
    // Reset notification status when undoing a task
    if (!data.completed) {
      notifiedTasks.delete(taskId);
    }
    displayTasks();
    loadCalendarEvents();
  })
  .catch(err => alert("Error updating task: " + err));
}

function deleteTask(taskId) {
  if (confirm("Are you sure you want to delete this task?")) {
    fetch(`https://smart-task-scheduler-a7h9.onrender.com/delete-task/${taskId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" }
    })
    .then(res => res.json())
    .then(data => {
      console.log(data.message);
      notifiedTasks.delete(taskId);
      displayTasks();
      loadCalendarEvents();
    })
    .catch(err => alert("Error deleting task: " + err));
  }
}

function updateTaskProgress(taskId, progress) {
  fetch(`https://smart-task-scheduler-a7h9.onrender.com/update-progress/${taskId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      progress: parseInt(progress)
    })
  })
  .then(res => res.json())
  .then(data => {
    console.log(data.message);
    displayTasks();
  })
  .catch(err => alert("Error updating progress: " + err));
}

function openEditModal(taskId, taskName, taskDeadline, taskPriority) {
  // Convert 24-hour format to 12-hour format with AM/PM
  let hour = parseInt(taskDeadline);
  let ampm = hour >= 12 ? "PM" : "AM";
  let displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
  
  document.getElementById("editTaskId").value = taskId;
  document.getElementById("editTaskName").value = taskName;
  document.getElementById("editTaskDeadline").value = displayHour;
  document.getElementById("editTaskAmpm").value = ampm;
  document.getElementById("editTaskPriority").value = taskPriority;
  document.getElementById("editModal").classList.add("modal-visible");
}

function closeEditModal() {
  document.getElementById("editModal").classList.remove("modal-visible");
}

function saveEdit() {
  const taskId = document.getElementById("editTaskId").value;
  const name = document.getElementById("editTaskName").value;
  const deadline = document.getElementById("editTaskDeadline").value;
  const ampm = document.getElementById("editTaskAmpm").value;
  const priority = document.getElementById("editTaskPriority").value;

  if (!name || !deadline || !ampm || !priority) {
    alert("Please fill in all fields");
    return;
  }

  // Convert 12-hour format with AM/PM to 24-hour format
  const deadline24 = convertTo24Hour(deadline, ampm);

  fetch(`https://smart-task-scheduler-a7h9.onrender.com/update-task/${taskId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: name,
      deadline: deadline24,
      priority: priority
    })
  })
  .then(res => res.json())
  .then(data => {
    console.log(data.message);
    // Reset notification when deadline is edited
    notifiedTasks.delete(parseInt(taskId));
    closeEditModal();
    displayTasks();
    loadCalendarEvents();
  })
  .catch(err => alert("Error updating task: " + err));
}

function compareAlgorithms() {
  fetch("https://smart-task-scheduler-a7h9.onrender.com/compare")
    .then(res => res.json())
    .then(data => {
      document.getElementById("greedyTasks").innerText = data.greedy_tasks;
      document.getElementById("bruteProfit").innerText = data.bruteforce_profit;
    })
    .catch(err => alert("Error comparing algorithms: " + err));
}

function closeModal() {
  document.getElementById("dayModal").classList.remove("modal-visible");
}

function checkForMissedTasks() {
  fetch("https://smart-task-scheduler-a7h9.onrender.com/check-missed", {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  })
  .then(res => res.json())
  .then(data => {
    if (data.updated_ids && data.updated_ids.length > 0) {
      // Refresh the UI to reflect newly missed tasks
      displayTasks();
      loadCalendarEvents();
    }
  })
  .catch(err => console.error("Error checking missed tasks:", err));
}
  fetch("https://smart-task-scheduler-a7h9.onrender.com/tasks")
    .then(res => res.json())
    .then(tasks => {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      
      tasks.forEach(task => {
        // Skip if task is already completed or notification already sent
        if (task.completed || notifiedTasks.has(task.id)) {
          return;
        }
        
        // Get task deadline date
        const taskDate = task.date || today;
        const taskDeadline = new Date(taskDate + 'T' + String(task.deadline).padStart(2, '0') + ':00:00');
        
        // Calculate time difference in milliseconds
        const timeDiff = taskDeadline - now;
        
        // Check if deadline is within the next 24 hours (86400000 ms) but not in the past
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;
        if (timeDiff > 0 && timeDiff <= ONE_DAY_MS) {
          // Send notification
          if ('Notification' in window && Notification.permission === 'granted') {
            const hours = Math.floor(timeDiff / (1000 * 60 * 60));
            const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
            
            new Notification('Task Deadline Reminder! 🔔', {
              body: `"${task.name}" is due in ${hours}h ${minutes}m. Priority: ${task.priority}`,
              icon: '/favicon.ico',
              tag: `task-${task.id}`,
              requireInteraction: true
            });
          }
          
          // Mark this task as notified
          notifiedTasks.add(task.id);
        }
      });
    })
    .catch(err => console.error("Error checking deadlines: " + err));
