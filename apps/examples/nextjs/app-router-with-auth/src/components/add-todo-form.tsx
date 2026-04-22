import AddTodoInputs from '../components/add-todo-inputs';
import { addTodo } from '../actions';

export default function AddTodoForm() {
  return (
    <form className="flex gap-2 mb-8" action={addTodo}>
      <AddTodoInputs />
    </form>
  );
}
