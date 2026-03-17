/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { act, fireEvent } from '@testing-library/react'
import { createRoot } from 'react-dom/client'

describe('hook sanity',()=>{
  it('renders simple hook component', async ()=>{
    function C(){ const [x,setX]=useState(0); return <button onClick={()=>setX(x+1)}>{x}</button> }
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async()=>{
      root.render(<C />)
      await Promise.resolve()
    })
    expect(container.textContent).toBe('0')

    const button = container.querySelector('button')
    await act(async()=>{
      fireEvent.click(button as HTMLButtonElement)
      await Promise.resolve()
    })

    expect(container.textContent).toBe('1')
  })
})
