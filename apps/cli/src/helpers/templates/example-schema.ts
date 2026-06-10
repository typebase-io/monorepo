export const exampleSchemaTemplate = (withAuth: boolean) => {
  return `import { p } from "typebase-io/db";

export const todos = p.pgTable("todos", {
  id: p.integer().primaryKey().generatedAlwaysAsIdentity(),
  value: p.varchar({ length: 255 }).notNull(),
  completed: p.boolean().notNull(),
  ${
    withAuth
      ? 'userId: p.text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),\n  createdAt: p.timestamp().notNull().defaultNow(),'
      : 'createdAt: p.timestamp().notNull().defaultNow(),'
  }
});`;
};
