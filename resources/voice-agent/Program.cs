using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Windows.Media.SpeechRecognition;
using Windows.Globalization;

namespace VoiceAgent;

class Program
{
    private static SpeechRecognizer? _recognizer;
    private static readonly AutoResetEvent _exitEvent = new(false);
    private static readonly List<string> _wakeWords = new();
    private static string _mode = "wake"; // "wake" or "command"
    private static Timer? _commandTimeoutTimer;
    private static bool _isRunning;
    private static bool _userStopped;
    private static int _restartAttempts;
    private const int MaxRestartAttempts = 5;

    static async Task Main(string[] args)
    {
        // ── Parse arguments ──────────────────────────────────────────────────────
        var wakeWordsArg = new List<string>();
        string language = "ru-RU";
        int commandTimeoutMs = 7000;

        for (int i = 0; i < args.Length; i++)
        {
            if (args[i] == "--wake-words" && i + 1 < args.Length)
            {
                i++;
                while (i < args.Length && !args[i].StartsWith("--"))
                {
                    wakeWordsArg.Add(args[i].ToLowerInvariant());
                    i++;
                }
                i--;
            }
            else if (args[i] == "--language" && i + 1 < args.Length)
            {
                language = args[++i];
            }
            else if (args[i] == "--command-timeout" && i + 1 < args.Length)
            {
                if (int.TryParse(args[++i], out var t)) commandTimeoutMs = t;
            }
        }

        _wakeWords.AddRange(wakeWordsArg.Count > 0 ? wakeWordsArg : new[] { "ассистент", "assistant", "джарвис", "jarvis" });

        // ── Graceful shutdown ──────────────────────────────────────────────────
        Console.CancelKeyPress += (_, e) =>
        {
            e.Cancel = true;
            _userStopped = true;
            Stop();
        };

        AppDomain.CurrentDomain.ProcessExit += (_, _) =>
        {
            _userStopped = true;
            Stop();
        };

        // ── Main loop with auto-restart ────────────────────────────────────────
        while (!_userStopped)
        {
            try
            {
                await RunRecognizerAsync(language, commandTimeoutMs);
                break; // clean exit
            }
            catch (Exception ex)
            {
                if (_userStopped) break;

                _restartAttempts++;
                if (_restartAttempts >= MaxRestartAttempts)
                {
                    Console.WriteLine("STATUS:ERROR_CRITICAL");
                    Console.Error.WriteLine($"Fatal: {ex.Message}");
                    break;
                }

                var delay = Math.Min(1000 * _restartAttempts, 5000);
                Console.WriteLine($"STATUS:RESTARTING");
                Console.Error.WriteLine($"[VoiceAgent] Crash, restarting in {delay}ms (attempt {_restartAttempts}/{MaxRestartAttempts}): {ex.Message}");
                await Task.Delay(delay);
            }
        }

        Console.WriteLine("STATUS:STOPPED");
    }

    private static async Task RunRecognizerAsync(string languageTag, int commandTimeoutMs)
    {
        // ── Initialize recognizer ──────────────────────────────────────────────
        var lang = new Language(languageTag);
        _recognizer = new SpeechRecognizer(lang);

        // Wire up events
        _recognizer.ContinuousRecognitionSession.ResultGenerated += (s, e) =>
            _ = OnResultGeneratedAsync(e, commandTimeoutMs);

        _recognizer.StateChanged += (s, e) =>
        {
            // Debug: log state changes to stderr so stdout stays clean for IPC
            // Console.Error.WriteLine($"[State] {e.State}");
        };

        // Start with wake-word grammar
        await SetWakeGrammarAsync();

        var compileResult = await _recognizer.CompileConstraintsAsync();
        if (compileResult.Status != SpeechRecognitionResultStatus.Success)
        {
            Console.WriteLine("STATUS:ERROR_LANGUAGE_PACK");
            Console.Error.WriteLine($"CompileConstraints failed: {compileResult.Status}");
            return;
        }

        Console.WriteLine("STATUS:READY");
        Console.Out.Flush();

        _mode = "wake";
        _isRunning = true;
        _restartAttempts = 0; // success resets counter

        await _recognizer.ContinuousRecognitionSession.StartAsync();
        Console.WriteLine("STATUS:WAITING");
        Console.Out.Flush();

        // Block until signaled to stop
        _exitEvent.WaitOne();

        // ── Cleanup ────────────────────────────────────────────────────────────
        _commandTimeoutTimer?.Dispose();
        _commandTimeoutTimer = null;

        if (_recognizer != null)
        {
            try { await _recognizer.ContinuousRecognitionSession.StopAsync(); } catch { }
            _recognizer.Dispose();
            _recognizer = null;
        }

        _isRunning = false;
    }

    private static async Task SetWakeGrammarAsync()
    {
        if (_recognizer == null) return;
        _recognizer.Constraints.Clear();
        var listConstraint = new SpeechRecognitionListConstraint(_wakeWords, "WakeWords");
        _recognizer.Constraints.Add(listConstraint);
        await _recognizer.CompileConstraintsAsync();
    }

    private static async Task SetCommandGrammarAsync()
    {
        if (_recognizer == null) return;
        _recognizer.Constraints.Clear();
        // Dictation topic constraint enables free-form speech recognition
        var dictationConstraint = new SpeechRecognitionTopicConstraint(SpeechRecognitionScenario.Dictation, "Dictation");
        _recognizer.Constraints.Add(dictationConstraint);
        await _recognizer.CompileConstraintsAsync();
    }

    private static async Task OnResultGeneratedAsync(SpeechContinuousRecognitionResultGeneratedEventArgs args, int commandTimeoutMs)
    {
        try
        {
            if (args.Result.Confidence == SpeechRecognitionConfidence.Rejected)
                return;

            var text = args.Result.Text.Trim();
            var lowerText = text.ToLowerInvariant();
            var confidence = args.Result.Confidence; // High, Medium, Low

            // Debug log to stderr
            Console.Error.WriteLine($"[Heard] {text} (conf: {confidence})");

            if (_mode == "wake")
            {
                bool isWake = _wakeWords.Any(w => lowerText.Contains(w));
                if (isWake)
                {
                    Console.WriteLine($"WAKE_DETECTED:{text}");
                    Console.Out.Flush();

                    _mode = "command";
                    await SwitchToCommandModeAsync(commandTimeoutMs);
                }
            }
            else if (_mode == "command")
            {
                // Cancel auto-return timer since we got a result
                _commandTimeoutTimer?.Dispose();
                _commandTimeoutTimer = null;

                Console.WriteLine($"COMMAND:{text}");
                Console.Out.Flush();

                _mode = "wake";
                await SwitchToWakeModeAsync();
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[OnResultGenerated] Error: {ex.Message}");
        }
    }

    private static async Task SwitchToCommandModeAsync(int commandTimeoutMs)
    {
        if (_recognizer == null) return;
        try
        {
            await _recognizer.ContinuousRecognitionSession.StopAsync();
            await SetCommandGrammarAsync();

            Console.WriteLine("STATUS:LISTENING");
            Console.Out.Flush();

            await _recognizer.ContinuousRecognitionSession.StartAsync();

            // Auto-return to wake mode after timeout (silence / no command)
            _commandTimeoutTimer?.Dispose();
            _commandTimeoutTimer = new Timer(async _ =>
            {
                try
                {
                    if (_mode == "command")
                    {
                        _mode = "wake";
                        await SwitchToWakeModeAsync();
                    }
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"[CommandTimeout] Error: {ex.Message}");
                }
            }, null, commandTimeoutMs, Timeout.Infinite);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[SwitchToCommand] Error: {ex.Message}");
        }
    }

    private static async Task SwitchToWakeModeAsync()
    {
        if (_recognizer == null) return;
        try
        {
            _commandTimeoutTimer?.Dispose();
            _commandTimeoutTimer = null;

            await _recognizer.ContinuousRecognitionSession.StopAsync();
            await SetWakeGrammarAsync();

            Console.WriteLine("STATUS:WAITING");
            Console.Out.Flush();

            await _recognizer.ContinuousRecognitionSession.StartAsync();
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[SwitchToWake] Error: {ex.Message}");
        }
    }

    private static void Stop()
    {
        _userStopped = true;
        _exitEvent.Set();
    }
}
