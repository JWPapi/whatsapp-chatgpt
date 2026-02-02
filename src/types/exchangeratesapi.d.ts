declare module '@abskmj/exchangeratesapi' {
  interface RatesOptions {
    access_key?: string
    base?: string
  }

  interface RatesResponse {
    data: {
      rates: Record<string, number>
    }
  }

  const exchange: {
    rates: (options: RatesOptions) => Promise<RatesResponse>
  }

  export default exchange
}
