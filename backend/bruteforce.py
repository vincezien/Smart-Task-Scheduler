import itertools

def get_priority_value(priority):
    if priority == "High":
        return 10
    elif priority == "Medium":
        return 5
    else:
        return 1

def brute_force_schedule(tasks):
    best_profit = 0
    best_schedule = []

    for perm in itertools.permutations(tasks):
        time = 0
        profit = 0
        schedule = []

        for task in perm:
            if time + task.duration <= task.deadline:
                schedule.append(task)
                time += task.duration
                profit += get_priority_value(task.priority)

        if profit > best_profit:
            best_profit = profit
            best_schedule = schedule

    return best_schedule, best_profit
