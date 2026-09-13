const loaded = new Map<string, Promise<void>>();
export function loadScript(url: string): Promise<void> {
  let task = loaded.get(url);
  if (!task) {
    task = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const timer = window.setTimeout(() => {
        script.remove();
        reject(new Error("Платформа не ответила"));
      }, 15000);
      script.src = url;
      script.async = true;
      script.onload = () => {
        clearTimeout(timer);
        resolve();
      };
      script.onerror = () => {
        clearTimeout(timer);
        script.remove();
        reject(new Error("Не удалось загрузить SDK"));
      };
      document.head.append(script);
    });
    loaded.set(url, task);
    task.catch(() => loaded.delete(url));
  }
  return task;
}
export function withTimeout<T>(task: Promise<T>, ms = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Платформа не ответила")),
      ms,
    );
    task.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
