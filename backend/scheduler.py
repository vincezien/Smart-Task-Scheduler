def get_color(priority):
    if priority == "High":
        return "red"
    elif priority == "Medium":
        return "orange"
    else:
        return "green"


def greedy_schedule(tasks):
    tasks.sort(key=lambda x: x.deadline)

    current_time = 0
    scheduled = []
    skipped = []

    for task in tasks:
        if current_time + task.duration <= task.deadline:
            start_time = f"{int(current_time):02d}:00"
            end_time = f"{int(current_time + task.duration):02d}:00"
            scheduled.append({
                "title": task.name,
                "start": start_time,
                "end": end_time,
                "priority": task.priority,
                "color": get_color(task.priority)
            })
            current_time += task.duration
        else:
            skipped.append(task.name)

    return scheduled, skipped
