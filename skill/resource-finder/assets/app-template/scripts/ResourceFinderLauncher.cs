using System;
using System.Diagnostics;
using System.IO;
using System.Net.Sockets;
using System.Threading;

internal static class ResourceFinderLauncher
{
    private const int DefaultPort = 5177;

    [STAThread]
    private static void Main()
    {
        string appDir = AppDomain.CurrentDomain.BaseDirectory;
        string envPath = Path.Combine(appDir, ".env");
        int port = ReadPort(envPath, DefaultPort);
        string url = "http://localhost:" + port + "/";

        if (!IsPortOpen("127.0.0.1", port))
        {
            StartServer(appDir);
            Thread.Sleep(1200);
        }

        Process.Start(new ProcessStartInfo
        {
            FileName = url,
            UseShellExecute = true
        });
    }

    private static void StartServer(string appDir)
    {
        string localNode = Path.Combine(appDir, "node.exe");
        string nodePath = File.Exists(localNode) ? localNode : "node";
        string serverPath = Path.Combine(appDir, "server.js");
        string logPath = Path.Combine(appDir, "server.log");

        ProcessStartInfo startInfo = new ProcessStartInfo
        {
            FileName = nodePath,
            Arguments = "\"" + serverPath + "\"",
            WorkingDirectory = appDir,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };

        Process process = new Process { StartInfo = startInfo, EnableRaisingEvents = true };
        process.OutputDataReceived += (_, e) => AppendLog(logPath, e.Data);
        process.ErrorDataReceived += (_, e) => AppendLog(logPath, e.Data);
        process.Start();
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
    }

    private static bool IsPortOpen(string host, int port)
    {
        try
        {
            using (TcpClient client = new TcpClient())
            {
                IAsyncResult result = client.BeginConnect(host, port, null, null);
                bool success = result.AsyncWaitHandle.WaitOne(TimeSpan.FromMilliseconds(300));
                if (!success) return false;
                client.EndConnect(result);
                return true;
            }
        }
        catch
        {
            return false;
        }
    }

    private static int ReadPort(string envPath, int fallback)
    {
        try
        {
            if (!File.Exists(envPath)) return fallback;
            foreach (string rawLine in File.ReadAllLines(envPath))
            {
                string line = rawLine.Trim();
                if (line.StartsWith("PORT=", StringComparison.OrdinalIgnoreCase))
                {
                    string value = line.Substring("PORT=".Length).Trim().Trim('"', '\'');
                    int parsed;
                    if (int.TryParse(value, out parsed)) return parsed;
                }
            }
        }
        catch
        {
        }

        return fallback;
    }

    private static void AppendLog(string path, string line)
    {
        if (String.IsNullOrWhiteSpace(line)) return;
        try
        {
            File.AppendAllText(path, "[" + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "] " + line + Environment.NewLine);
        }
        catch
        {
        }
    }
}
