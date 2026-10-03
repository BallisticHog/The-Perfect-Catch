try
{
    const response = await fetch("http://127.0.0.1:3000/health", {
        redirect: "manual",
        signal: AbortSignal.timeout(4000),
    });
    process.exit(response.status === 200 ? 0 : 1);
}
catch
{
    process.exit(1);
}
