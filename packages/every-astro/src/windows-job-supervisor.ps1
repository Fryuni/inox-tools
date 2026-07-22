param(
	[Parameter(Mandatory = $true)]
	[string] $ControlFile
)

$ErrorActionPreference = 'Stop'

try {
	$control = Get-Content -LiteralPath $ControlFile -Raw | ConvertFrom-Json
	$command = Get-Command -Name $control.file -CommandType Application -ErrorAction Stop | Select-Object -First 1
	$targetFile = $command.Path
	$targetArguments = [string[]] @($control.args)

	Add-Type @'
using System;
using System.ComponentModel;
using System.Text;
using System.Threading;
using System.Runtime.InteropServices;

public static class EveryAstroWindowsJob {
    private const uint CREATE_SUSPENDED = 0x00000004;
    private const uint STARTF_USESTDHANDLES = 0x00000100;
    private const int STD_INPUT_HANDLE = -10;
    private const int STD_OUTPUT_HANDLE = -11;
    private const int STD_ERROR_HANDLE = -12;
    private const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000;
    private const int JobObjectBasicAccountingInformation = 1;
    private const int JobObjectExtendedLimitInformation = 9;
    private const uint INFINITE = 0xffffffff;

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct STARTUPINFO {
        public int cb;
        public string lpReserved;
        public string lpDesktop;
        public string lpTitle;
        public int dwX;
        public int dwY;
        public int dwXSize;
        public int dwYSize;
        public int dwXCountChars;
        public int dwYCountChars;
        public int dwFillAttribute;
        public int dwFlags;
        public short wShowWindow;
        public short cbReserved2;
        public IntPtr lpReserved2;
        public IntPtr hStdInput;
        public IntPtr hStdOutput;
        public IntPtr hStdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct PROCESS_INFORMATION {
        public IntPtr hProcess;
        public IntPtr hThread;
        public int dwProcessId;
        public int dwThreadId;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct JOBOBJECT_BASIC_LIMIT_INFORMATION {
        public long PerProcessUserTimeLimit;
        public long PerJobUserTimeLimit;
        public uint LimitFlags;
        public UIntPtr MinimumWorkingSetSize;
        public UIntPtr MaximumWorkingSetSize;
        public uint ActiveProcessLimit;
        public IntPtr Affinity;
        public uint PriorityClass;
        public uint SchedulingClass;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct IO_COUNTERS {
        public ulong ReadOperationCount;
        public ulong WriteOperationCount;
        public ulong OtherOperationCount;
        public ulong ReadTransferCount;
        public ulong WriteTransferCount;
        public ulong OtherTransferCount;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
        public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
        public IO_COUNTERS IoInfo;
        public UIntPtr ProcessMemoryLimit;
        public UIntPtr JobMemoryLimit;
        public UIntPtr PeakProcessMemoryUsed;
        public UIntPtr PeakJobMemoryUsed;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct JOBOBJECT_BASIC_ACCOUNTING_INFORMATION {
        public long TotalUserTime;
        public long TotalKernelTime;
        public long ThisPeriodTotalUserTime;
        public long ThisPeriodTotalKernelTime;
        public uint TotalPageFaultCount;
        public uint TotalProcesses;
        public uint ActiveProcesses;
        public uint TotalTerminatedProcesses;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr CreateJobObject(IntPtr jobAttributes, string name);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetInformationJobObject(
        IntPtr job,
        int informationClass,
        ref JOBOBJECT_EXTENDED_LIMIT_INFORMATION information,
        int informationLength
    );

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool QueryInformationJobObject(
        IntPtr job,
        int informationClass,
        out JOBOBJECT_BASIC_ACCOUNTING_INFORMATION information,
        int informationLength,
        IntPtr returnLength
    );

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CreateProcess(
        string applicationName,
        StringBuilder commandLine,
        IntPtr processAttributes,
        IntPtr threadAttributes,
        bool inheritHandles,
        uint creationFlags,
        IntPtr environment,
        string currentDirectory,
        ref STARTUPINFO startupInfo,
        out PROCESS_INFORMATION processInformation
    );

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern uint ResumeThread(IntPtr thread);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetExitCodeProcess(IntPtr process, out uint exitCode);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool TerminateProcess(IntPtr process, uint exitCode);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool TerminateJobObject(IntPtr job, uint exitCode);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr GetStdHandle(int standardHandle);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(IntPtr handle);

    private static void Check(bool result, string operation) {
        if (!result) throw new Win32Exception(Marshal.GetLastWin32Error(), operation);
    }

    private static string Quote(string value) {
        var quoted = new StringBuilder("\"");
        var backslashes = 0;
        foreach (var character in value) {
            if (character == '\\') {
                backslashes++;
            } else if (character == '"') {
                quoted.Append('\\', backslashes * 2 + 1);
                quoted.Append(character);
                backslashes = 0;
            } else {
                quoted.Append('\\', backslashes);
                quoted.Append(character);
                backslashes = 0;
            }
        }
        quoted.Append('\\', backslashes * 2);
        quoted.Append('"');
        return quoted.ToString();
    }

    private static StringBuilder BuildCommandLine(string file, string[] arguments) {
        var commandLine = new StringBuilder(Quote(file));
        foreach (var argument in arguments) commandLine.Append(' ').Append(Quote(argument));
        return commandLine;
    }

    private static string EscapeMetaCharacters(string value) {
        const string metaCharacters = "()[]%!^\"`<>&|;, *?";
        var escaped = new StringBuilder();
        foreach (var character in value) {
            if (metaCharacters.IndexOf(character) >= 0) escaped.Append('^');
            escaped.Append(character);
        }
        return escaped.ToString();
    }

    private static string EscapeBatchArgument(string value, bool doubleEscapeMetaCharacters) {
        var escaped = new StringBuilder();
        for (var index = 0; index < value.Length;) {
            if (value[index] != '\\') {
                escaped.Append(value[index++]);
                continue;
            }
            var next = index;
            while (next < value.Length && value[next] == '\\') next++;
            var slashCount = next - index;
            if (next == value.Length) {
                escaped.Append('\\', slashCount * 2);
            } else if (value[next] == '"') {
                escaped.Append('\\', slashCount * 2 + 1);
                escaped.Append('"');
                next++;
            } else {
                escaped.Append('\\', slashCount);
            }
            index = next;
        }
        var quoted = EscapeMetaCharacters("\"" + escaped + "\"");
        return doubleEscapeMetaCharacters ? EscapeMetaCharacters(quoted) : quoted;
    }

    private static bool IsCmdShim(string file) {
        var normalized = file.Replace('/', '\\');
        return normalized.IndexOf("\\node_modules\\.bin\\", StringComparison.OrdinalIgnoreCase) >= 0 &&
            normalized.EndsWith(".cmd", StringComparison.OrdinalIgnoreCase);
    }

    private static StringBuilder BuildCmdCommandLine(string cmd, string batchFile, string[] arguments) {
        var shellCommand = new StringBuilder(EscapeMetaCharacters(batchFile.Replace('/', '\\')));
        var doubleEscapeMetaCharacters = IsCmdShim(batchFile);
        foreach (var argument in arguments) {
            shellCommand.Append(' ').Append(EscapeBatchArgument(argument, doubleEscapeMetaCharacters));
        }
        return new StringBuilder(Quote(cmd)).Append(" /d /s /c \"").Append(shellCommand).Append("\"");
    }

    private static void Drain(IntPtr job) {
        while (true) {
            JOBOBJECT_BASIC_ACCOUNTING_INFORMATION accounting;
            Check(
                QueryInformationJobObject(
                    job,
                    JobObjectBasicAccountingInformation,
                    out accounting,
                    Marshal.SizeOf(typeof(JOBOBJECT_BASIC_ACCOUNTING_INFORMATION)),
                    IntPtr.Zero
                ),
                "QueryInformationJobObject"
            );
            if (accounting.ActiveProcesses == 0) return;
            Thread.Sleep(10);
        }
    }

    public static int Run(string file, string[] arguments, string workingDirectory) {
        IntPtr job = CreateJobObject(IntPtr.Zero, null);
        if (job == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error(), "CreateJobObject");

        PROCESS_INFORMATION process = new PROCESS_INFORMATION();
        var processCreated = false;
        try {
            var limits = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
            limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            Check(
                SetInformationJobObject(
                    job,
                    JobObjectExtendedLimitInformation,
                    ref limits,
                    Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION))
                ),
                "SetInformationJobObject"
            );

            var targetFile = file;
            var commandLine = BuildCommandLine(file, arguments);
            if (file.EndsWith(".cmd", StringComparison.OrdinalIgnoreCase) || file.EndsWith(".bat", StringComparison.OrdinalIgnoreCase)) {
                targetFile = Environment.GetEnvironmentVariable("ComSpec") ?? "cmd.exe";
                commandLine = BuildCmdCommandLine(targetFile, file, arguments);
            }

            var startupInfo = new STARTUPINFO();
            startupInfo.cb = Marshal.SizeOf(typeof(STARTUPINFO));
            startupInfo.dwFlags = (int)STARTF_USESTDHANDLES;
            startupInfo.hStdInput = GetStdHandle(STD_INPUT_HANDLE);
            startupInfo.hStdOutput = GetStdHandle(STD_OUTPUT_HANDLE);
            startupInfo.hStdError = GetStdHandle(STD_ERROR_HANDLE);
            Check(
                CreateProcess(
                    targetFile,
                    commandLine,
                    IntPtr.Zero,
                    IntPtr.Zero,
                    true,
                    CREATE_SUSPENDED,
                    IntPtr.Zero,
                    workingDirectory,
                    ref startupInfo,
                    out process
                ),
                "CreateProcessW"
            );
            processCreated = true;
            try {
                Check(AssignProcessToJobObject(job, process.hProcess), "AssignProcessToJobObject");
            } catch {
                TerminateProcess(process.hProcess, 1);
                WaitForSingleObject(process.hProcess, INFINITE);
                throw;
            }
            if (ResumeThread(process.hThread) == 0xffffffff) {
                throw new Win32Exception(Marshal.GetLastWin32Error(), "ResumeThread");
            }

            WaitForSingleObject(process.hProcess, INFINITE);
            uint exitCode;
            Check(GetExitCodeProcess(process.hProcess, out exitCode), "GetExitCodeProcess");
            return unchecked((int)exitCode);
        } finally {
            if (processCreated) {
                Check(TerminateJobObject(job, 1), "TerminateJobObject");
                Drain(job);
                CloseHandle(process.hThread);
                CloseHandle(process.hProcess);
            }
            CloseHandle(job);
        }
    }
}
'@

	exit [EveryAstroWindowsJob]::Run($targetFile, $targetArguments, [Environment]::CurrentDirectory)
} finally {
	Remove-Item -LiteralPath $ControlFile -Force -ErrorAction SilentlyContinue
}
