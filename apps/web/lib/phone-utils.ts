/**
 * Normaliza um número de telefone removendo todos os caracteres não numéricos
 * Retorna apenas os dígitos, no formato usado pelo agente (ex: "554197429568")
 * 
 * @param phone - Número de telefone com ou sem formatação
 * @returns Número de telefone apenas com dígitos
 * 
 * @example
 * normalizePhoneNumber("(41) 97429-568") // "4197429568"
 * normalizePhoneNumber("+55 41 97429-568") // "554197429568"
 * normalizePhoneNumber("554197429568@s.whatsapp.net") // "554197429568"
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return "";
  // Remove todos os caracteres não numéricos
  return phone.replace(/\D/g, "");
}

/**
 * Formata um número de telefone para exibição
 * Formato: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
 * 
 * @param phone - Número de telefone apenas com dígitos
 * @returns Número formatado para exibição
 * 
 * @example
 * formatPhoneNumber("4197429568") // "(41) 97429-568"
 * formatPhoneNumber("4198765432") // "(41) 98765-432"
 * formatPhoneNumber("5541997429568") // "(41) 99742-9568"
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return "";
  let digits = normalizePhoneNumber(phone);
  
  // Se o número começa com 55 (código do país Brasil), remover
  if (digits.startsWith("55") && digits.length > 11) {
    digits = digits.slice(2);
  }
  
  if (digits.length === 10) {
    // Telefone fixo: (XX) XXXX-XXXX
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11) {
    // Celular: (XX) XXXXX-XXXX
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  } else if (digits.length > 11) {
    // Se ainda tiver mais de 11 dígitos após remover o 55, usar os últimos 11
    const last11 = digits.slice(-11);
    return `(${last11.slice(0, 2)}) ${last11.slice(2, 7)}-${last11.slice(7)}`;
  }
  
  return digits;
}

