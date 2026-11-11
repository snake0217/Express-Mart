/**
 * Motor de Cálculo del Carrito y Desglose Financiero (RF-04, SEG-05)
 * Soporta beneficios de Miembro Premium ExpressPrime: Envíos gratis y 5% de Cashback en compras
 */

const IVA_RATE = 0.16;
const STANDARD_SHIPPING_COST = 99.00;
const FREE_SHIPPING_THRESHOLD = 999.00;

function calculateCartTotals(itemsWithPrices, couponRow = null, isPremium = false) {
  const rawSubtotal = itemsWithPrices.reduce((acc, item) => {
    const qty = Number(item.cantidad);
    const price = Number(item.precio);
    return acc + qty * price;
  }, 0);

  const subtotal = Number(rawSubtotal.toFixed(2));
  let descuento = 0;
  let envioGratisPorCupon = false;
  let cuponAplicado = null;

  if (couponRow && couponRow.activo && subtotal >= Number(couponRow.monto_minimo || 0)) {
    cuponAplicado = couponRow.codigo;
    if (couponRow.tipo === 'porcentaje') {
      descuento = Number(((subtotal * Number(couponRow.valor)) / 100).toFixed(2));
    } else if (couponRow.tipo === 'monto_fijo') {
      descuento = Math.min(subtotal, Number(couponRow.valor));
    } else if (couponRow.tipo === 'envio_gratis') {
      envioGratisPorCupon = true;
    }
  }

  // Beneficios Miembro Premium: 5% de Cashback en compras y Envíos Gratis siempre
  let cashback = 0;
  if (isPremium && subtotal > 0) {
    cashback = Number((subtotal * 0.05).toFixed(2));
  }

  const totalDescuentoCalculado = Number((descuento + cashback).toFixed(2));
  const baseGravable = Math.max(0, Number((subtotal - totalDescuentoCalculado).toFixed(2)));
  const impuestos = Number((baseGravable * IVA_RATE).toFixed(2));
  const costoEnvio =
    subtotal === 0 || isPremium || subtotal >= FREE_SHIPPING_THRESHOLD || envioGratisPorCupon
      ? 0
      : STANDARD_SHIPPING_COST;
  const total = Number((baseGravable + impuestos + costoEnvio).toFixed(2));

  return {
    subtotal,
    descuento,
    cashback,
    descuentoTotal: totalDescuentoCalculado,
    isPremium: Boolean(isPremium),
    impuestos,
    costoEnvio,
    total,
    cuponAplicado
  };
}

module.exports = {
  IVA_RATE,
  STANDARD_SHIPPING_COST,
  FREE_SHIPPING_THRESHOLD,
  calculateCartTotals
};
