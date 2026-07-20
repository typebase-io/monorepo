import { Project, SyntaxKind } from 'ts-morph';

export const addExampleTodosRelation = ({ relationsFilePath }: { relationsFilePath: string }) => {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const sourceFile = project.addSourceFileAtPath(relationsFilePath);

  const callbackBody = sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((callExpr) => callExpr.getExpression().getText() === 'q.defineRelations')
    ?.getArguments()[1]
    ?.asKind(SyntaxKind.ArrowFunction)
    ?.getBody();

  const relationsCallback = callbackBody?.asKind(SyntaxKind.ParenthesizedExpression)?.getExpression() ?? callbackBody;
  const relationsObject = relationsCallback?.asKind(SyntaxKind.ObjectLiteralExpression);

  const usersObject = relationsObject
    ?.getProperty('users')
    ?.asKind(SyntaxKind.PropertyAssignment)
    ?.getInitializer()
    ?.asKind(SyntaxKind.ObjectLiteralExpression);

  if (!usersObject) {
    throw new Error(`Could not add the example todos relation: no \`users\` entry found in \`${relationsFilePath}\`.`);
  }

  const usersProperties = usersObject.getProperties().map((prop) => prop.getText());

  usersProperties.push(`todos: r.many.todos({\n      from: r.users.id,\n      to: r.todos.userId,\n    })`);

  const usersText = `{\n${usersProperties.map((prop) => `    ${prop},`).join('\n')}\n  }`;
  const fileText = sourceFile.getFullText();

  sourceFile.replaceWithText(`${fileText.slice(0, usersObject.getStart())}${usersText}${fileText.slice(usersObject.getEnd())}`);
  sourceFile.saveSync();
};
