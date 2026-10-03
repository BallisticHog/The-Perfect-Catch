import http from "node:http";
import net from "node:net";

const listenHost = "127.0.0.1";
const listenPort = Number.parseInt(process.env.CATCH_PREVIEW_PORT ?? "4318", 10);
const targetHost = "127.0.0.1";
const targetPort = Number.parseInt(process.env.CATCH_WEB_PORT ?? "4317", 10);
const reviewSecret = process.env.LOCAL_REVIEW_SECRET;

if (!reviewSecret || reviewSecret.length < 32)
{
    throw new Error("LOCAL_REVIEW_SECRET must contain at least 32 characters");
}

function forwardedHeaders(headers)
{
    return {
        ...headers,
        host: `${targetHost}:${targetPort}`,
        "x-forwarded-host": `${listenHost}:${listenPort}`,
        "x-forwarded-proto": "http",
        "x-the-catch-local-review": reviewSecret,
    };
}

const server = http.createServer((request, response) =>
{
    const upstream = http.request(
        {
            hostname: targetHost,
            port: targetPort,
            method: request.method,
            path: request.url,
            headers: forwardedHeaders(request.headers),
        },
        (upstreamResponse) =>
        {
            response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
            upstreamResponse.pipe(response);
        },
    );

    upstream.on("error", (error) =>
    {
        response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
        response.end(`The Catch web process is not ready yet.\n\n${error.message}\n`);
    });
    request.pipe(upstream);
});

server.on("upgrade", (request, socket, head) =>
{
    const upstream = net.connect(targetPort, targetHost, () =>
    {
        const headerLines = Object.entries(forwardedHeaders(request.headers))
            .flatMap(([name, value]) =>
                Array.isArray(value) ? value.map((item) => `${name}: ${item}`) : [`${name}: ${value}`]
            );
        upstream.write(
            `${request.method} ${request.url} HTTP/${request.httpVersion}\r\n${
                headerLines.join("\r\n")
            }\r\n\r\n`,
        );
        if (head.length)
        {
            upstream.write(head);
        }
        socket.pipe(upstream).pipe(socket);
    });

    upstream.on("error", () => socket.destroy());
});

server.listen(listenPort, listenHost, () =>
{
    console.info(`The Catch local preview is available at http://${listenHost}:${listenPort}`);
});
