/**
 * Frontend API client for fetching data from the backend.
 * Handles authentication headers, error responses, and pagination.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | undefined>;
}

interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface SingleResponse<T> {
  success: boolean;
  data: T;
}

class ApiClient {
  private async request<T>(
    endpoint: string,
    options: FetchOptions = {}
  ): Promise<T> {
    const { params, ...fetchOptions } = options;

    let url = `${API_BASE}${endpoint}`;

    // Add query params
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          searchParams.set(key, String(value));
        }
      });
      const qs = searchParams.toString();
      if (qs) url += `?${qs}`;
    }

    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        "Content-Type": "application/json",
        ...fetchOptions.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error?.message || `API Error: ${response.status}`
      );
    }

    return data;
  }

  // ---- Leads ----
  async getLeads(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    temperature?: string;
    sortBy?: string;
    sortOrder?: string;
  }) {
    return this.request<PaginatedResponse<any>>("/api/leads", { params });
  }

  async getLead(id: string) {
    return this.request<SingleResponse<any>>(`/api/leads/${id}`);
  }

  async createLead(data: any) {
    return this.request<SingleResponse<any>>("/api/leads", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateLead(id: string, data: any) {
    return this.request<SingleResponse<any>>(`/api/leads/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteLead(id: string) {
    return this.request<SingleResponse<any>>(`/api/leads/${id}`, {
      method: "DELETE",
    });
  }

  // ---- Accounts ----
  async getAccounts(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }) {
    return this.request<PaginatedResponse<any>>("/api/accounts", { params });
  }

  async getAccount(id: string) {
    return this.request<SingleResponse<any>>(`/api/accounts/${id}`);
  }

  async createAccount(data: any) {
    return this.request<SingleResponse<any>>("/api/accounts", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateAccount(id: string, data: any) {
    return this.request<SingleResponse<any>>(`/api/accounts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  // ---- Opportunities ----
  async getOpportunities(params?: {
    page?: number;
    limit?: number;
    search?: string;
    stage?: string;
    ownerId?: string;
  }) {
    return this.request<PaginatedResponse<any>>("/api/opportunities", {
      params,
    });
  }

  async getOpportunity(id: string) {
    return this.request<SingleResponse<any>>(`/api/opportunities/${id}`);
  }

  async createOpportunity(data: any) {
    return this.request<SingleResponse<any>>("/api/opportunities", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateOpportunity(id: string, data: any) {
    return this.request<SingleResponse<any>>(`/api/opportunities/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  // ---- Contacts ----
  async getContacts(params?: {
    page?: number;
    limit?: number;
    search?: string;
    companyId?: string;
  }) {
    return this.request<PaginatedResponse<any>>("/api/contacts", { params });
  }

  async getContact(id: string) {
    return this.request<SingleResponse<any>>(`/api/contacts/${id}`);
  }

  async createContact(data: any) {
    return this.request<SingleResponse<any>>("/api/contacts", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateContact(id: string, data: any) {
    return this.request<SingleResponse<any>>(`/api/contacts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  // ---- Tasks ----
  async getTasks(params?: {
    page?: number;
    limit?: number;
    status?: string;
    priority?: string;
    type?: string;
    ownerId?: string;
  }) {
    return this.request<PaginatedResponse<any>>("/api/tasks", { params });
  }

  async getTask(id: string) {
    return this.request<SingleResponse<any>>(`/api/tasks/${id}`);
  }

  async createTask(data: any) {
    return this.request<SingleResponse<any>>("/api/tasks", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateTask(id: string, data: any) {
    return this.request<SingleResponse<any>>(`/api/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteTask(id: string) {
    return this.request<SingleResponse<any>>(`/api/tasks/${id}`, {
      method: "DELETE",
    });
  }

  // ---- Meetings ----
  async getMeetings(params?: {
    page?: number;
    limit?: number;
    search?: string;
    ownerId?: string;
  }) {
    return this.request<PaginatedResponse<any>>("/api/meetings", { params });
  }

  async getMeeting(id: string) {
    return this.request<SingleResponse<any>>(`/api/meetings/${id}`);
  }

  async createMeeting(data: any) {
    return this.request<SingleResponse<any>>("/api/meetings", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateMeeting(id: string, data: any) {
    return this.request<SingleResponse<any>>(`/api/meetings/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  // ---- Activities ----
  async getActivities(params?: {
    leadId?: string;
    opportunityId?: string;
    type?: string;
  }) {
    return this.request<SingleResponse<any[]>>("/api/activities", { params });
  }

  async createActivity(data: any) {
    return this.request<SingleResponse<any>>("/api/activities", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // ---- Read-only endpoints ----
  async getInsights(params?: { category?: string; impact?: string }) {
    return this.request<SingleResponse<any[]>>("/api/insights", { params });
  }

  async getForecasts() {
    return this.request<SingleResponse<any[]>>("/api/forecast");
  }

  async getIntegrations() {
    return this.request<SingleResponse<any[]>>("/api/integrations");
  }

  async getPlaybooks() {
    return this.request<SingleResponse<any[]>>("/api/playbooks");
  }
}

export const api = new ApiClient();
