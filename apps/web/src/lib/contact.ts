export function publicContactEmail(): string | null
{
    const value = process.env.PUBLIC_CONTACT_EMAIL;
    return value && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value) && !value.endsWith(".invalid")
        ? value
        : null;
}
