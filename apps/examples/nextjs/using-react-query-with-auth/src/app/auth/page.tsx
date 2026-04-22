import AuthForm from '../../components/auth-form';

export default function Auth() {
  return (
    <div className="flex flex-1 items-start justify-center bg-zinc-50 pt-24 px-4 dark:bg-black">
      <div className="w-full max-w-lg flex flex-col items-center">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-8">Welcome</h1>
        <AuthForm />
      </div>
    </div>
  );
}
