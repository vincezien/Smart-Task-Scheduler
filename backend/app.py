from flask import Flask, request, jsonify
from flask_cors import CORS
from models import Task
from scheduler import greedy_schedule
from bruteforce import brute_force_schedule


app = Flask(__name__)
CORS(app)

tasks = []

@app.route("/add-task", methods=["POST"])
def add_task():
    data = request.json
    task = Task(
        len(tasks),
        data["name"],
        int(data["duration"]),
        int(data["deadline"]),
        data["priority"],
        data.get("date")
    )
    tasks.append(task)
    return jsonify({"message": "Task added"})

@app.route("/tasks", methods=["GET"])
def get_tasks():
    task_list = [{
        "id": t.id,
        "name": t.name,
        "duration": t.duration,
        "deadline": t.deadline,
        "priority": t.priority,
        "date": getattr(t, "date", None),
        "completed": getattr(t, "completed", False),
        "progress": getattr(t, "progress", 0),
        "status": getattr(t, "status", "pending")
    } for t in tasks]
    return jsonify(task_list)

@app.route("/schedule", methods=["GET"])
def schedule():
    scheduled, skipped = greedy_schedule(tasks)
    return jsonify({
        "scheduled": scheduled,
        "skipped": skipped
    })

@app.route("/delete-task/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    global tasks
    tasks = [t for t in tasks if t.id != task_id]
    return jsonify({"message": "Task deleted"})

@app.route("/complete-task/<int:task_id>", methods=["PUT"])
def complete_task(task_id):
    from datetime import datetime
    for task in tasks:
        if task.id == task_id:
            # Toggle: if already done, revert to pending
            if task.completed:
                task.completed = False
                task.status = "pending"
                return jsonify({"message": "Task marked as pending", "completed": False, "status": "pending"})
            
            # Marking as complete — check if past deadline
            task.completed = True
            now = datetime.now()
            try:
                task_date = task.date or now.strftime("%Y-%m-%d")
                deadline_dt = datetime.strptime(
                    f"{task_date} {int(task.deadline):02d}:00",
                    "%Y-%m-%d %H:%M"
                )
                task.status = "late" if now > deadline_dt else "completed"
            except Exception:
                task.status = "completed"

            return jsonify({
                "message": f"Task marked as {task.status}",
                "completed": True,
                "status": task.status
            })
    return jsonify({"error": "Task not found"}), 404

@app.route("/update-progress/<int:task_id>", methods=["PUT"])
def update_progress(task_id):
    data = request.json
    progress = int(data.get("progress", 0))
    
    # Clamp progress between 0 and 100
    progress = max(0, min(100, progress))
    
    for task in tasks:
        if task.id == task_id:
            task.progress = progress
            return jsonify({"message": "Task progress updated", "progress": task.progress})
    return jsonify({"error": "Task not found"}), 404

@app.route("/update-task/<int:task_id>", methods=["PUT"])
def update_task(task_id):
    data = request.json
    for task in tasks:
        if task.id == task_id:
            task.name = data.get("name", task.name)
            task.duration = int(data.get("duration", task.duration))
            task.deadline = int(data.get("deadline", task.deadline))
            task.priority = data.get("priority", task.priority)
            if "date" in data:
                task.date = data["date"]
            return jsonify({"message": "Task updated"})
    return jsonify({"error": "Task not found"}), 404

@app.route("/compare", methods=["GET"]) 
def compare(): 
    greedy_result, _ = greedy_schedule(tasks) 
    brute_tasks, brute_profit = brute_force_schedule(tasks) 
    return jsonify({ 
        "greedy_tasks": len(greedy_result), 
        "bruteforce_profit": brute_profit 
    })

@app.route("/check-missed", methods=["POST"])
def check_missed():
    """Mark overdue, incomplete tasks as 'missed'."""
    from datetime import datetime
    now = datetime.now()
    updated = []
    for task in tasks:
        if task.completed or task.status == "missed":
            continue
        try:
            task_date = task.date or now.strftime("%Y-%m-%d")
            deadline_dt = datetime.strptime(
                f"{task_date} {int(task.deadline):02d}:00",
                "%Y-%m-%d %H:%M"
            )
            if now > deadline_dt:
                task.status = "missed"
                updated.append(task.id)
        except Exception:
            pass
    return jsonify({"message": "Missed tasks updated", "updated_ids": updated})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)