export function defaults<T extends Record<string, any>>(values: T | undefined, defaultValues: T): T {
  if (!values) {
    return defaultValues;
  }
  values = Object.assign({}, values);

  for (const key in defaultValues) {
    if (values[key] === undefined) {
      values[key] = defaultValues[key];
    }
  }
  return values;
}
