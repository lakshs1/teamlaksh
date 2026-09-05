import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CreateQuotationPage from '../features/quotations/CreateQuotationPage';

describe('CreateQuotationPage Component', () => {
  it('renders the quotation builder page with default fields and line items', () => {
    render(
      <MemoryRouter>
        <CreateQuotationPage />
      </MemoryRouter>
    );

    // Check header and breadcrumbs
    expect(screen.getByText(/New Quotation/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save as Draft/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Submit for Approval/i })).toBeInTheDocument();

    // Check customer dropdown & default product line
    expect(screen.getByText(/Customer/i)).toBeInTheDocument();
    expect(screen.getByText(/Titan Blade Server Node X8/i)).toBeInTheDocument();

    // Check live margin indicator bar
    expect(screen.getByText(/Live Margin:/i)).toBeInTheDocument();
    expect(screen.getByText(/Blended Risk Score:/i)).toBeInTheDocument();

    // Check AI Upsell Panel
    expect(screen.getByText(/AI Upsell & Recommendations/i)).toBeInTheDocument();
  });

  it('allows adding a product from AI upsell recommendations', () => {
    render(
      <MemoryRouter>
        <CreateQuotationPage />
      </MemoryRouter>
    );

    const addButtons = screen.getAllByRole('button', { name: /\+ Add to Quote/i });
    expect(addButtons.length).toBeGreaterThan(0);

    fireEvent.click(addButtons[0]);
    // The line should be added
    expect(screen.getByText(/Order Lines \(2\)/i)).toBeInTheDocument();
  });

  it('allows switching between Order Lines and Other Information tabs', () => {
    render(
      <MemoryRouter>
        <CreateQuotationPage />
      </MemoryRouter>
    );

    const otherInfoTab = screen.getByRole('button', { name: /Other Information/i });
    fireEvent.click(otherInfoTab);

    expect(screen.getByText(/Sales Information/i)).toBeInTheDocument();
    expect(screen.getByText(/Fiscal & Terms/i)).toBeInTheDocument();
  });
});

