import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HomePage } from './HomePage';

describe('HomePage', () => {
  it('does not create a room without a name', async () => {
    const user = userEvent.setup();
    const onCreateRoom = vi.fn();

    render(<HomePage onCreateRoom={onCreateRoom} onJoinRoom={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Criar sala' }));

    expect(onCreateRoom).not.toHaveBeenCalled();
    expect(screen.getByText(/informe seu nome/i)).toBeInTheDocument();
  });

  it('creates a room with the provided name', async () => {
    const user = userEvent.setup();
    const onCreateRoom = vi.fn();

    render(<HomePage onCreateRoom={onCreateRoom} onJoinRoom={vi.fn()} />);

    await user.type(screen.getByLabelText(/nome/i), 'Ana');
    await user.click(screen.getByRole('button', { name: 'Criar sala' }));

    expect(onCreateRoom).toHaveBeenCalledWith('Ana');
  });
});
