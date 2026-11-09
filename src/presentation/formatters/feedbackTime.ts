// horários da avaliação sempre no fuso do evento, mesmo que o celular esteja em outro
const TIME_ZONE = 'America/Araguaina';

const dateParts = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIME_ZONE,
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function parts(iso: string): { weekday: string; date: string; time: string } {
  const found: Record<string, string> = {};
  for (const part of dateParts.formatToParts(new Date(iso))) found[part.type] = part.value;
  const minute = found['minute'] ?? '00';
  const time = `${found['hour'] ?? ''}h${minute === '00' ? '' : minute}`;
  return { weekday: found['weekday'] ?? '', date: `${found['day'] ?? ''}/${found['month'] ?? ''}`, time };
}

// "até as 23h59"
export const untilText = (iso: string): string => `até as ${parts(iso).time}`;

// "sexta-feira, 13/11, às 19h"
export function whenText(iso: string): string {
  const { weekday, date, time } = parts(iso);
  return `${weekday}, ${date}, às ${time}`;
}
