class Task:
    def __init__(self, id, name, duration, deadline, priority, date=None, completed=False, progress=0):
        self.id = id
        self.name = name
        self.duration = duration
        self.deadline = deadline
        self.priority = priority
        self.date = date
        self.completed = completed
        self.progress = progress
