import { toggleTodo, deleteTodo } from '../actions';
import { client } from '../lib/typebase/client/client';
import DeleteTodoInput from './delete-todo-input';
import ToggleTodoInput from './toggle-todo-input';

export default async function Todos() {
  const todos = await client.queries.todos.getMany();

  return (
    <>
      {todos.length === 0 ? (
        <p className="text-center text-zinc-400 dark:text-zinc-500">No todos yet. Add one above!</p>
      ) : (
        <ul className="space-y-2">
          {todos.map((todo) => (
            <li
              key={todo.id}
              className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <form action={toggleTodo}>
                <ToggleTodoInput todo={todo} />
              </form>

              <span className={`flex-1 ${todo.completed ? 'text-zinc-400 line-through dark:text-zinc-600' : 'text-zinc-900 dark:text-zinc-50'}`}>
                <div className="flex flex-col">
                  <p>{todo.value}</p>
                  <p className="text-sm text-zinc-400 dark:text-zinc-600">{todo.createdAt.toISOString().split('T')[0]}</p>
                </div>
              </span>

              <form action={deleteTodo}>
                <DeleteTodoInput id={todo.id} />
              </form>
            </li>
          ))}
        </ul>
      )}

      {todos.length > 0 && <p className="mt-4 text-sm text-zinc-400 dark:text-zinc-500">{todos.filter((t) => !t.completed).length} remaining</p>}
    </>
  );
}
