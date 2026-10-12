/** Client-side distance (same formula as the API's App\Support\Geo). */
export const Geo = {
  distanceKm(a, b) {
    const rad = (d) => (d * Math.PI) / 180
    const dLat = rad(b.lat - a.lat)
    const dLng = rad(b.lng - a.lng)
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
    return Math.round(6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) * 100) / 100
  },
}
