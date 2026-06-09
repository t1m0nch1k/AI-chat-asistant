
import { CoderAction } from '../types'

/**
 * Parses XML-like action tags from LLM response.
 * Example: <action type="read" path="src/main.ts" />
 */
export function parseCoderAction(text: string): CoderAction | null {
  const readMatch = text.match(/<action\s+type="read"\s+path="([^"]+)"\s*\/>/);
  if (readMatch) return { type: 'read', path: readMatch[1] };

  const terminalMatch = text.match(/<action\s+type="terminal"\s+command="([^"]+)"\s*\/>/);
  if (terminalMatch) return { type: 'terminal', command: terminalMatch[1] };

  const writeMatch = text.match(/<action\s+type="write"\s+path="([^"]+)">([\s\S]*?)<\/action>/);
  if (writeMatch) return { type: 'write', path: writeMatch[1], content: writeMatch[2] };

  const patchMatch = text.match(/<action\s+type="patch"\s+path="([^"]+)">\s*<search>([\s\S]*?)<\/search>\s*<replace>([\s\S]*?)<\/replace>\s*<\/action>/);
  if (patchMatch) return { type: 'patch', path: patchMatch[1], search: patchMatch[2], replace: patchMatch[3] };

  return null;
}

/**
 * Strips XML action tags from text for clean display in chat.
 */
export function stripCoderActions(text: string): string {
  return text.replace(/<action[\s\S]*?<\/action>/g, '').replace(/<action[\s\S]*?\/>/g, '').trim();
}
