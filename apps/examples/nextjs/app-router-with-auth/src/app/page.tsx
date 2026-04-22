import Todos from '../components/todos';
import { Suspense } from 'react';
import TodosSkeleton from '../components/todos-skeleton';
import AddTodoForm from '../components/add-todo-form';

export default async function Home() {
  return (
    <div className="flex flex-1 items-start justify-center bg-zinc-50 pt-24 px-4 dark:bg-black">
      <div className="w-full max-w-lg">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-8">Todo App</h1>

        <AddTodoForm />

        <Suspense fallback={<TodosSkeleton />}>
          <Todos />
        </Suspense>
      </div>
    </div>
  );
}
