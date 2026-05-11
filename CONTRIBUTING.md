# Contributing

Thanks for your interest in contributing to Typebase! Please follow the conventions below for commits, branches, and pull requests.

## Commits

Commit messages must be written in English following this convention:

```
type(app/context): description
```

### Type

- **feat**: A new feature.
- **fix**: Bug correction.
- **docs**: Changes on the documentation.
- **style**: Changes that don't affect the code (spaces, indentations, etc).
- **test**: Add, modifies or improves a test.
- **chore**: Changes on the build process, workflows or auxiliary tools.

### App

The app indicates in which project the change was made.

For example:

```
type(cli/context): description
```

### Context

The context is a word that refers to the place in the code or functionality that the commit affects. It must always be written in `kebab-case`.

In cases when you modify a specific part of the code more information should be given:

- If you are modifying a file the context should be the name of the thing modified. For example: `user-model`.
- When there is not an available name to use, you can use the name of the file. For example: `date-helper`.
- If you want to add more information you can use `/` to separate the text. For example: `api/login-service`.

### Description

- Separated using a `space` from the context.
- No capital letter at the beginning.
- No period at the end.

## Branch Name

Branch names must be written in English following this convention:

```
type-description
```

- The type is the same used for the commits.
- The description must be written using imperative verbs, all in lower case and using `-` instead of spaces.

## Pull Request

Pull request titles must be written in English and should describe the change clearly. You can use the same convention as the commits:

```
type(app/context): description
```
