import Todos from '../components/todos';
import AddTodoForm from '../components/add-todo-form';
import { getQueryClient } from '../lib/tanstack-query/get-query-client';
import { client } from '../lib/typebase/client/client';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

export default async function Home() {
  const queryClient = getQueryClient();

  void queryClient.prefetchQuery(client.queries.todos.getMany.queryOptions());

  return (
    <div className="flex flex-1 items-start justify-center bg-zinc-50 pt-24 px-4 dark:bg-black">
      <div className="w-full max-w-lg">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-8">Todo App</h1>

        <AddTodoForm />

        <HydrationBoundary state={dehydrate(queryClient)}>
          <Todos />
        </HydrationBoundary>
      </div>
    </div>
  );
}
